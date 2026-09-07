import { defineConfig } from "vitest/config";

// Pure-logic unit tests run in a Node environment. Async Server Components are
// intentionally out of scope (Vitest cannot render them yet) — those are
// covered by end-to-end checks instead. `@/` path aliases resolve natively
// from tsconfig.json.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Runs before any test module is imported. Gives `react`'s server-only
    // `cache` a plain call-through, which Next provides on the server and the
    // bare React 18 package does not — see tests/setup.ts.
    setupFiles: ["tests/setup.ts"],
  },
});
