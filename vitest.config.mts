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
  },
});
