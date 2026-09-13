import { readFile } from "node:fs/promises";
import path from "node:path";
import * as ort from "onnxruntime-node";
import sharp from "sharp";

/**
 * Lifting a shoe off its background.
 *
 * U2NetP, the small U-2-Net, under Apache-2.0 — which matters more than it
 * sounds. The two models that score higher cannot legally be used here: RMBG
 * 2.0 is CC BY-NC and the shop is a business, and @imgly's package is AGPL.
 * U2NetP is 4.6 MB against U2Net's 176 MB, and the size it gives up buys edge
 * quality on hair and fur, which a sandal does not have.
 *
 * What this is honestly for: a photo shot against a plain surface, where it
 * does very well. On the shop's current photos — a shoe held in one hand in a
 * storeroom, with bagged stock behind — it keeps the hand and some of the
 * bags, because those are foreground too and no model can know which
 * foreground was meant. remove.bg at 97% would keep the hand as well. That is
 * why the screen shows the result and asks before saving anything: the honest
 * fix for those photos is a white cloth, and this is for the rest.
 *
 * Three things here were wrong in the first working draft and are worth
 * naming, because each produced a plausible-looking picture rather than an
 * error:
 *
 *   1. The model has seven outputs. The first is the fused one; the others are
 *      side supervision at lower detail.
 *   2. Its output is already 0..1 — a sigmoid applied on top flattens
 *      everything toward the middle and the mask stops separating anything.
 *   3. sharp's resize turns a 1-channel raw buffer into 3 channels. Reading
 *      the result as if it were still 1 channel takes every third byte, so the
 *      alpha is built from a stripe of the mask and the cut-out looks like
 *      nothing was removed. `toColourspace("b-w")` holds it at one channel.
 */

/** The size U-2-Net was trained at. */
const EDGE = 320;

/** ImageNet normalisation, which is what the model expects. */
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

/** The shop's paper colour, so a cut-out sits on the page rather than on white. */
const PAPER = { r: 0xfd, g: 0xfb, b: 0xf7 };

let session: ort.InferenceSession | null = null;

/**
 * Load once and keep. The model is 4.6 MB and takes about a second to
 * initialise, which is worth paying on the first photo and not on the rest.
 */
async function getSession() {
  if (!session) {
    const file = path.join(process.cwd(), "models", "u2netp.onnx");
    session = await ort.InferenceSession.create(await readFile(file));
  }
  return session;
}

export type CutOut = {
  /** The shoe on the shop's paper colour, square, as WebP. */
  bytes: Buffer;
  contentType: "image/webp";
  /** How much of the frame survived, 0-100. Reported so the screen can warn. */
  keptPercent: number;
};

/**
 * Cut the background out of one photo.
 *
 * Returns null rather than throwing on anything it cannot do — the caller is
 * offering an improvement, and a failure here must never cost the shopkeeper
 * the photo they are holding.
 */
export async function removePhotoBackground(input: Buffer): Promise<CutOut | null> {
  try {
    const model = await getSession();
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) return null;

    // Prepare the 320x320 input.
    const { data } = await sharp(input)
      .resize(EDGE, EDGE, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = new Float32Array(3 * EDGE * EDGE);
    for (let i = 0; i < EDGE * EDGE; i += 1) {
      for (let c = 0; c < 3; c += 1) {
        tensor[c * EDGE * EDGE + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
      }
    }

    const result = await model.run({
      [model.inputNames[0]]: new ort.Tensor("float32", tensor, [1, 3, EDGE, EDGE]),
    });

    // The first output is the fused prediction; the rest are side outputs.
    const prediction = result[model.outputNames[0]].data as Float32Array;

    // Already 0..1. Stretch to the full range rather than passing it through a
    // sigmoid, which would collapse the separation.
    let low = Infinity;
    let high = -Infinity;
    for (const value of prediction) {
      if (value < low) low = value;
      if (value > high) high = value;
    }
    const span = high - low || 1;

    const small = Buffer.alloc(EDGE * EDGE);
    for (let i = 0; i < EDGE * EDGE; i += 1) {
      small[i] = Math.round(((prediction[i] - low) / span) * 255);
    }

    // Grow the mask to the photo's size, held at one channel.
    const mask = await sharp(small, { raw: { width: EDGE, height: EDGE, channels: 1 } })
      .resize(meta.width, meta.height)
      .toColourspace("b-w")
      .raw()
      .toBuffer();

    const pixels = meta.width * meta.height;
    if (mask.length !== pixels) return null;

    const rgb = await sharp(input).rotate().removeAlpha().raw().toBuffer();
    if (rgb.length !== pixels * 3) return null;

    const rgba = Buffer.alloc(pixels * 4);
    let kept = 0;
    for (let i = 0; i < pixels; i += 1) {
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = mask[i];
      if (mask[i] > 127) kept += 1;
    }

    const keptPercent = Math.round((kept / pixels) * 1000) / 10;

    // Nothing found, or the whole frame kept: either way the cut-out is not an
    // improvement, and saying so is better than returning a picture that looks
    // processed but is not.
    if (keptPercent < 2 || keptPercent > 95) return null;

    const bytes = await sharp(rgba, { raw: { width: meta.width, height: meta.height, channels: 4 } })
      .flatten({ background: PAPER })
      .resize(1600, 1600, { fit: "contain", background: { ...PAPER, alpha: 1 } })
      .webp({ quality: 82 })
      .toBuffer();

    return { bytes, contentType: "image/webp", keptPercent };
  } catch {
    return null;
  }
}
