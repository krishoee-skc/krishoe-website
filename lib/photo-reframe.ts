import sharp from "sharp";
import { FRAME_RATIO } from "@/lib/prepare-product-photo";

/**
 * Old photos with bars in them (owner, 2026-10-02: "two photos side by side on
 * a phone, and each one filling its place").
 *
 * The shop's first photos were squared by padding: a tall phone shot was set in
 * the middle of a square and the sides filled with paper. Doctor Chappal's real
 * picture is 360 of the 640 pixels across — the rest is two grey bars, which
 * the card then draws as part of the photo, so the shoe shows small in a wide
 * empty frame. The Add photos screen frames new photos before they go up; this
 * mends the ones already up.
 *
 * It finds the bars (a border of one even colour, as sharp's trim sees it),
 * takes the picture inside them, and frames that at 4:5 from its centre. It
 * changes nothing by itself: the screen shows the result first, and a saved
 * fix goes in as a new photo, with the old one kept behind it.
 */

/** Bars narrower than this share of the photo are left alone: a little even edge is just a wall. */
const MIN_BAR_SHARE = 0.08;

/** How close to the corner colour a pixel must be to count as bar. */
const TRIM_THRESHOLD = 18;

export type Reframe = {
  /** The photo's own size, in pixels. */
  width: number;
  height: number;
  /** The 4:5 piece to keep, in the photo's pixels. */
  left: number;
  top: number;
  cropWidth: number;
  cropHeight: number;
};

/**
 * The 4:5 piece of a photo once its bars are cut, or null when it has no bars
 * worth cutting. `inner` is the picture inside the bars, in the photo's pixels.
 */
export function reframeBox(
  width: number,
  height: number,
  inner: { left: number; top: number; width: number; height: number },
): Reframe | null {
  if (width <= 0 || height <= 0 || inner.width <= 0 || inner.height <= 0) return null;
  const cutAcross = 1 - inner.width / width;
  const cutDown = 1 - inner.height / height;
  if (cutAcross < MIN_BAR_SHARE && cutDown < MIN_BAR_SHARE) return null;
  // What is left must still be a photograph, not a sliver of one.
  if (inner.width < width * 0.3 || inner.height < height * 0.3) return null;

  let cropWidth = inner.width;
  let cropHeight = inner.height;
  if (inner.width / inner.height > FRAME_RATIO) cropWidth = Math.round(inner.height * FRAME_RATIO);
  else cropHeight = Math.round(inner.width / FRAME_RATIO);

  return {
    width,
    height,
    left: Math.round(inner.left + (inner.width - cropWidth) / 2),
    top: Math.round(inner.top + (inner.height - cropHeight) / 2),
    cropWidth,
    cropHeight,
  };
}

/** Where a photo's bars are, or null if it has none worth cutting (or cannot be read). */
export async function findReframe(input: Buffer): Promise<Reframe | null> {
  try {
    const image = sharp(input, { failOn: "none" }).rotate();
    const upright = await image.toBuffer({ resolveWithObject: true });
    const { width, height } = upright.info;
    const trimmed = await sharp(upright.data).trim({ threshold: TRIM_THRESHOLD }).toBuffer({ resolveWithObject: true });
    const info = trimmed.info as typeof trimmed.info & { trimOffsetLeft?: number; trimOffsetTop?: number };
    return reframeBox(width, height, {
      left: Math.abs(info.trimOffsetLeft ?? 0),
      top: Math.abs(info.trimOffsetTop ?? 0),
      width: info.width,
      height: info.height,
    });
  } catch {
    return null;
  }
}

/** The new photo: the kept piece, 1280 × 1600, as WebP. */
export async function reframePhoto(input: Buffer, frame: Reframe): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .rotate()
    .extract({ left: frame.left, top: frame.top, width: frame.cropWidth, height: frame.cropHeight })
    .resize(1280, 1600, { fit: "cover" })
    .webp({ quality: 84 })
    .toBuffer();
}
