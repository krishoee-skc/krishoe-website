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
    // A few worker processes, not one per test file.
    //
    // Vitest's default spawns a process per file, and at 293 files on a
    // four-core machine with about a gigabyte free that runs the box out of
    // memory. The symptom is the confusing kind: two or three files fail on one
    // run and a different two or three on the next, every one of them passing
    // on its own, and the file count collected drops below the number on disk —
    // 290 of 293 — so files were being lost, not failing. Nothing was wrong
    // with the tests that failed; they were the ones running when the memory
    // went.
    //
    // Three was measured, not guessed: unbounded and four both stayed flaky,
    // three and two were clean across repeated full runs, and three is the
    // faster of the two. Files still run in parallel — there are simply no
    // longer hundreds of processes competing for the same memory.
    maxWorkers: 3,
  },
});
