import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { canPrepare, prepareProductPhoto, TARGET_EDGE } from "@/lib/prepare-product-photo";
import sharp from "sharp";

/**
 * Photos, prepared on the way in.
 *
 * The design came from measuring the shop's own photos, and the measurement
 * contradicted the obvious plan. The first seven products carried 99-178 KB
 * files at 900x1600, every one named `whatsapp-image-...` because WhatsApp
 * re-encodes what it forwards. "Shrink the upload", which is what this kind of
 * feature usually does, would have made the real problem worse: these are not
 * too big, they are too small for the frame the product page draws them in.
 *
 * So the job is to square, straighten, enlarge toward the drawn size, and
 * re-encode — and above all not to lose the picture.
 *
 * The padding decision is the one worth defending. Squaring by cropping is
 * cheaper to write and takes the toe or the heel off a sandal shot in
 * portrait, which is how a phone is held. Padding with the shop's paper colour
 * keeps the whole shoe and reads as the page behind it. Verified on the
 * owner's own photo: 900x1600 in, 1600x1600 out, nothing cut.
 */

/** A photo the size the owner's phone actually produces, via WhatsApp. */
async function realisticPhoto(width = 900, height = 1600) {
  return sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 40, b: 48 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

describe("what happens to a photo on its way in", () => {
  it("squares it, because the shop's grid is one shape", async () => {
    const prepared = await prepareProductPhoto(await realisticPhoto(), "image/jpeg");

    expect(prepared, "a normal JPEG was refused").not.toBeNull();
    expect(prepared!.width).toBe(prepared!.height);
  });

  it("pads rather than crops, so no part of the shoe is lost", async () => {
    // A tall, narrow photo — a sandal shot in portrait, which is how a phone
    // is held. A centre crop to a square would take 44% of its height.
    const prepared = await prepareProductPhoto(await realisticPhoto(900, 1600), "image/jpeg");
    const meta = await sharp(prepared!.bytes).metadata();

    expect(meta.width).toBe(TARGET_EDGE);
    expect(meta.height).toBe(TARGET_EDGE);

    // The proof that it padded: the corners carry the shop's paper colour,
    // which the photograph itself does not contain.
    const { data } = await sharp(prepared!.bytes)
      .extract({ left: 4, top: 4, width: 8, height: 8 })
      .raw()
      .toBuffer({ resolveWithObject: true });

    expect(data[0], "the corner is not paper — this cropped").toBeGreaterThan(0xf0);
    expect(data[1]).toBeGreaterThan(0xf0);
    expect(data[2]).toBeGreaterThan(0xef);
  });

  it("grows a small photo toward the size the shop draws", async () => {
    const prepared = await prepareProductPhoto(await realisticPhoto(900, 1600), "image/jpeg");

    // 1600 on the long edge already; the point is that it is not shrunk to
    // fit some smaller idea of "optimised".
    expect(prepared!.width).toBe(TARGET_EDGE);
  });

  it("re-encodes as WebP, which is about half the bytes", async () => {
    const prepared = await prepareProductPhoto(await realisticPhoto(), "image/jpeg");

    expect(prepared!.contentType).toBe("image/webp");
    expect(prepared!.extension).toBe("webp");

    const meta = await sharp(prepared!.bytes).metadata();
    expect(meta.format).toBe("webp");
  });

  it("turns a phone's sideways photo upright", async () => {
    // A phone writes an orientation flag instead of rotating the pixels.
    // Browsers honour it; sharp does not unless asked, so without rotate() a
    // photo that looked upright on the phone arrives on its side.
    const source = await readFile("lib/prepare-product-photo.ts", "utf8");

    expect(source).toContain(".rotate()");
  });
});

describe("what it must never do", () => {
  it("never throws, so a photo is never lost to a failed optimisation", async () => {
    const notAnImage = Buffer.from("this is not a photograph, it is text");

    // Returning null means "store the original" — the caller's job is to save
    // the shopkeeper's photo, and this is only an improvement on the way.
    await expect(prepareProductPhoto(notAnImage, "image/jpeg")).resolves.toBeNull();
  });

  it("leaves an animated GIF alone rather than flattening it", async () => {
    // Re-encoding one to WebP here would keep the first frame and silently
    // destroy the picture.
    expect(canPrepare("image/gif")).toBe(false);
  });

  it("refuses anything that is not an image it understands", async () => {
    expect(canPrepare("application/pdf")).toBe(false);
    expect(canPrepare("image/svg+xml")).toBe(false);
    expect(canPrepare("image/jpeg")).toBe(true);
    expect(canPrepare("image/png")).toBe(true);
  });
});

describe("where it is wired in", () => {
  it("sits on the one route every photo passes through", async () => {
    const route = await readFile("app/api/admin/upload/route.ts", "utf8");

    // Both the Add photos screen and the product form post here, so one place
    // covers every photo the shop takes.
    expect(route).toContain("prepareProductPhoto");
  });

  it("stores what came back, not the file it was handed", async () => {
    const route = await readFile("app/api/admin/upload/route.ts", "utf8");

    // The bug this guards: preparing the photo and then uploading `file`
    // anyway. Everything would pass, and nothing would change.
    expect(route).toContain("const bytes = prepared ? prepared.bytes : original;");
    expect(route).toContain("const contentType = prepared ? prepared.contentType : file.type;");
    expect(route).not.toContain("put(`products/${safeName}`, file,");
  });

  it("gives the stored file the extension it now really has", async () => {
    const route = await readFile("app/api/admin/upload/route.ts", "utf8");

    // A WebP saved as .jpg is served with the wrong type by some hosts.
    expect(route).toContain("prepared.extension");
  });

  it("records in the audit log what was done to the photo", async () => {
    const route = await readFile("app/api/admin/upload/route.ts", "utf8");

    expect(route).toContain("prepared.note");
  });
});
