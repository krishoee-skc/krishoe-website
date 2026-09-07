/**
 * What the tests need before any module loads.
 *
 * `cache` — React's per-request memo, used by lib/product-store's getProducts.
 * ------------------------------------------------------------------
 * Next resolves `react` through its "react-server" condition on the server, and
 * that build has `cache`. Vitest resolves the plain package instead, and React
 * 18's own entry point does not export it — so a dozen test files that only
 * wanted a pure function died on `cache is not a function` at import time,
 * before a single assertion ran.
 *
 * The shim below is what `cache` means to a test: call through, memoise
 * nothing. React's version deduplicates work inside one server request; a test
 * has no request, and each one wants a fresh read anyway — a memo held across
 * cases would be the bug, not the fix. Production is untouched and keeps the
 * real per-request cache.
 */
import { vi } from "vitest";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");

  return {
    ...actual,
    // Preserved so `import React from "react"` keeps working alongside the
    // named imports.
    default: actual,
    cache: <Args extends unknown[], Result>(fn: (...args: Args) => Result) => fn,
  };
});
