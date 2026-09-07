import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

// Browser checks run the optimized server, not `next dev`: that validates the
// artifact we deploy and avoids development-only HMR/CSP behavior. The package
// script builds first; this guard makes a direct Playwright invocation helpful.
if (!existsSync(".next/BUILD_ID")) {
  throw new Error("Build the app with `npm run build:ci` before starting browser tests.");
}

// The browser server must be repeatable and must never ask a developer's
// configured production database for data. It uses the seed/local JSON store.
const environment = {
  ...process.env,
  DATA_BACKEND: "local-json",
  PAYMENT_MODE: "manual",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "e2e-placeholder-password",
  ADMIN_SESSION_SECRET: process.env.ADMIN_SESSION_SECRET || "e2e-placeholder-admin-session-secret-value",
  CUSTOMER_SESSION_SECRET: process.env.CUSTOMER_SESSION_SECRET || "e2e-placeholder-customer-session-secret-value",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
};

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "3100"],
  { env: environment, stdio: "inherit", shell: false },
);

let stopping = false;
function stopServer() {
  if (stopping) return;
  stopping = true;
  child.kill();
  // If a platform does not deliver the signal to the child, do not leave a
  // browser-test command hanging forever.
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.once("SIGINT", stopServer);
process.once("SIGTERM", stopServer);

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (error) => {
  console.error(`Unable to start the browser test server: ${error.message}`);
  process.exitCode = 1;
});
