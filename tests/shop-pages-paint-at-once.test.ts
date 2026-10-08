import { stat } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const exists = async (path: string) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * The shop's own pages are made ahead of time (static), so their whole page is
 * in the first answer from the server. A loading.tsx beside one put a grey
 * skeleton in front of it instead: the real page — header included — sat
 * hidden in the same answer until React's script swapped it in, which on a
 * cheap phone was four to seven seconds after the photo had arrived. Measured
 * on the live shoe page, 2026-10-08: first picture 4.0 s with the skeleton,
 * 3.1 s without, and never the seven-second worst case.
 *
 * The admin screens keep theirs — they wait on the database, and there the
 * skeleton is what fills the wait (tests/busy-screens-have-a-loader.test.ts).
 */
describe("the shop's ready-made pages", () => {
  it.each(["app/product/[id]", "app/shop", "app/checkout", "app/cart", "app/contact", "app/wishlist"])(
    "%s shows the page itself first, not a skeleton",
    async (dir) => {
      expect(await exists(`${dir}/page.tsx`)).toBe(true);
      expect(await exists(`${dir}/loading.tsx`)).toBe(false);
    },
  );
});
