import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { removePhotoBackground } from "@/lib/remove-photo-background";

/**
 * Cutting a shoe out of its background.
 *
 * U2NetP under Apache-2.0, which is the whole reason it is this model and not
 * a better one. RMBG 2.0 scores 90% against this family's ~80% and is CC BY-NC
 * — non-commercial — and the shop is a business. @imgly's package is AGPL.
 * Those two were nearly built here before the licences were read.
 *
 * Three bugs in the first working draft are guarded below, because each
 * produced a plausible picture rather than an error, and each was found only
 * by looking at the output rather than at the numbers:
 *
 *   1. The model has seven outputs; only the first is the fused mask.
 *   2. Its output is already 0..1, so a sigmoid on top flattens it and the
 *      mask separates nothing.
 *   3. sharp's resize promotes a 1-channel raw buffer to 3 channels. Read back
 *      as 1 channel, the alpha is built from every third byte of the mask and
 *      the result looks exactly like a photo with nothing removed.
 *
 * The honest limit is recorded here too: on the shop's real photos — a shoe
 * held in one hand in a storeroom — it keeps the hand and some of the bagged
 * stock, because those are foreground and no model can know which foreground
 * was meant. remove.bg at 97% keeps the hand as well. That is why the panel
 * shows the result and asks, and why it says a white cloth does more.
 */

/** A shoe-like shape on a plain ground: the case this is actually for. */
async function shoeOnPlainGround() {
  const canvas = sharp({
    create: { width: 600, height: 600, channels: 3, background: { r: 245, g: 245, b: 242 } },
  });

  const shape = await sharp({
    create: { width: 260, height: 150, channels: 4, background: { r: 20, g: 20, b: 28, alpha: 1 } },
  })
    .png()
    .toBuffer();

  return canvas.composite([{ input: shape, top: 230, left: 170 }]).jpeg().toBuffer();
}

describe("what the cut-out gives back", () => {
  it("returns a WebP on the shop's paper, or nothing at all", async () => {
    const cut = await removePhotoBackground(await shoeOnPlainGround());

    // It may legitimately decline — the guard is that it never returns
    // something that is not a usable picture.
    if (cut) {
      expect(cut.contentType).toBe("image/webp");
      const meta = await sharp(cut.bytes).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBe(1600);
      expect(meta.height).toBe(1600);
    }
  });

  it("says how much of the frame it kept", async () => {
    const cut = await removePhotoBackground(await shoeOnPlainGround());

    if (cut) {
      expect(cut.keptPercent).toBeGreaterThan(0);
      expect(cut.keptPercent).toBeLessThan(100);
    }
  });

  it("never throws, whatever it is handed", async () => {
    // A failure here must never cost the shopkeeper the photo they are holding.
    await expect(removePhotoBackground(Buffer.from("not a photograph"))).resolves.toBeNull();
    await expect(removePhotoBackground(Buffer.alloc(0))).resolves.toBeNull();
  });

  it("declines rather than returning a cut-out that removed nothing", async () => {
    const source = await readFile("lib/remove-photo-background.ts", "utf8");

    // A mask keeping 95%+ found no edge; one keeping under 2% found no subject.
    // Either way the picture is not an improvement, and returning it would
    // look like a considered result.
    expect(source).toContain("keptPercent < 2 || keptPercent > 95");
  });
});

describe("the three bugs that looked like successes", () => {
  it("takes the fused output, not one of the six side outputs", async () => {
    const source = await readFile("lib/remove-photo-background.ts", "utf8");

    expect(source).toContain("model.outputNames[0]");
  });

  it("does not put a sigmoid on an output that is already 0..1", async () => {
    const source = await readFile("lib/remove-photo-background.ts", "utf8");

    expect(source).not.toContain("Math.exp(-");
  });

  it("holds the mask at one channel through the resize", async () => {
    const source = await readFile("lib/remove-photo-background.ts", "utf8");

    // Checked as a chained call, not as a word anywhere in the file. The first
    // draft of this test looked for the string, and the doc comment above
    // explaining the bug contains it — so deleting the real call left the test
    // passing. Verified by deleting it.
    expect(source).toMatch(/\.resize\(meta\.width, meta\.height\)\s*\n\s*\.toColourspace\("b-w"\)/);

    // And the length is checked rather than assumed, so if it ever promotes
    // again the answer is null instead of a wrong picture.
    expect(source).toContain("mask.length !== pixels");
  });
});

describe("how it is offered", () => {
  it("runs only when asked, never on upload", async () => {
    const upload = await readFile("app/api/admin/upload/route.ts", "utf8");

    // Automatic removal would put a bad cut-out in the shop before anyone saw
    // it. This is a judgement, so it gets its own route and a button.
    expect(upload).not.toContain("removePhotoBackground");
  });

  it("shows the result and saves nothing until the owner keeps it", async () => {
    const button = await readFile("components/admin/RemoveBackgroundButton.tsx", "utf8");

    expect(button).toContain("Keep this one");
    expect(button).toContain("Discard");
    expect(button).toContain("onKeep");
  });

  it("warns when it barely changed the picture", async () => {
    const button = await readFile("components/admin/RemoveBackgroundButton.tsx", "utf8");

    expect(button).toContain("result.keptPercent > 60");
  });

  it("tells the truth about what works better", async () => {
    const button = await readFile("components/admin/RemoveBackgroundButton.tsx", "utf8");
    const route = await readFile("app/api/admin/remove-background/route.ts", "utf8");

    expect(button).toContain("plain surface");
    expect(route).toContain("a white cloth behind it does more than this can");
  });

  it("is protected by the same permission as editing a product", async () => {
    const route = await readFile("app/api/admin/remove-background/route.ts", "utf8");

    expect(route).toContain('requireAdminPermission("products:write")');
  });
});

describe("what has to be shipped for it to work at all", () => {
  it("carries the model into the function that needs it", async () => {
    const config = await readFile("next.config.js", "utf8");

    // Nothing imports a .onnx file, so tracing would leave it behind and the
    // route would fail at runtime on a file that exists in the repo.
    expect(config).toContain("./models/u2netp.onnx");
  });

  it("leaves the Windows and macOS binaries behind", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const config = await readFile("next.config.js", "utf8");

    // The package is 283 MB across three platforms against Vercel's 250 MB
    // limit for one function. Vercel runs Linux.
    //
    // This is a prebuild step rather than a tracing exclude, and that is not a
    // preference. outputFileTracingExcludes was tried twice, in two glob
    // shapes, and neither worked: serverExternalPackages takes the package out
    // of the bundler's hands and the directory is then copied whole. Reading
    // the .nft.json after a build showed all thirteen binaries still traced
    // both times. The removal has to happen on disk first.
    expect(pkg.scripts.prebuild).toContain("trim-onnxruntime");

    // And the exclude that did not work is gone, rather than left in place
    // looking like protection. See tests/the-model-fits-the-server.test.ts.
    expect(config).not.toContain("outputFileTracingExcludes");
  });

  it("keeps the native package out of the bundler's hands", async () => {
    const config = await readFile("next.config.js", "utf8");

    expect(config).toContain('serverExternalPackages: ["onnxruntime-node", "sharp"]');
  });
});
