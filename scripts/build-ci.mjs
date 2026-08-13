import { spawn } from "node:child_process";

const environment = {
  ...process.env,
  DATA_BACKEND: "local-json",
  PAYMENT_MODE: process.env.PAYMENT_MODE || "manual",
};

const npmCli = process.env.npm_execpath;
const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
const args = npmCli ? [npmCli, "run", "build"] : ["run", "build"];
const child = spawn(command, args, {
  env: environment,
  stdio: "inherit",
  shell: false,
});

child.on("error", (error) => {
  console.error(`Unable to start the CI build: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`CI build stopped by signal ${signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = code ?? 1;
});
