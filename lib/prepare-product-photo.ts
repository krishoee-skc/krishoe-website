import sharp from "sharp";

/**
 * Preparing a product photo, on the way in.
 *
 * Written after measuring the shop's own photos rather than from the usual
 * advice, and the measurement turned the usual advice on its head. The first
 * seven products carried files of 99-178 KB at 900x1600 — every one named
 * `whatsapp-image-...`, because WhatsApp re-encodes what it forwards. The
 * standard job of "shrink the upload" would have made the one real problem
 * worse: these photos are not too big, they are too small, and the product
 * page draws them larger than they were shot.
 *
 * So this does four things, and deliberately not a fifth.
 *
 * It squares the frame, because the shop's grid is one shape and photos that
 * disagree with it are cropped by the browser at display time, without anyone
 * choosing where. Squaring by *padding* rather than cropping: a sandal shot
 * in portrait has its length along the long edge, so a centre crop takes the
 * toe or the heel off. Padding adds paper-coloured space instead and loses
 * nothing. The colour is the shop's own #FDFBF7, so the pad reads as the page
 * rather than as a white box sitting on it.
 *
 * It rotates by the EXIF orientation flag, which is what a phone writes
 * instead of turning the pixels. Browsers honour it; `sharp` does not unless
 * asked, so a photo that looked upright on the phone would arrive on its side.
 *
 * It converts to WebP, which carries the same picture in roughly half the
 * bytes. On a shop whose customers are mostly on phone data, half is worth
 * having even when the file was already small.
 *
 * It enlarges a small photo up to the size the shop actually draws — but only
 * up to 1600px, and never beyond twice what was supplied. Upscaling invents
 * nothing; it only stops the browser from doing the same enlargement worse,
 * with a cheaper filter, on every view.
 *
 * What it does not do is reject anything. A photo that cannot be processed is
 * stored exactly as it arrived. The shopkeeper is holding a shoe in one hand
 * and a phone in the other, and a failed upload at that moment is a worse
 * outcome than an unoptimised picture — the warning on the Add photos screen
 * already tells them when a photo is too small to look good.
 */

/** What the shop draws at its largest, on a wide screen's product page. */
export const TARGET_EDGE = 1600;

/** The shop's paper colour, so padding reads as the page behind it. */
const PAPER = { r: 0xfd, g: 0xfb, b: 0xf7, alpha: 1 };

/**
 * Formats worth re-encoding. GIF is excluded on purpose: an animated one would
 * be flattened to its first frame, which silently destroys the picture.
 */
const PROCESSABLE = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export type PreparedPhoto = {
  bytes: Buffer;
  contentType: string;
  extension: string;
  /** What changed, for the audit line and the screen's reply. */
  note: string;
  width: number;
  height: number;
  originalBytes: number;
};

export function canPrepare(contentType: string) {
  return PROCESSABLE.includes(contentType);
}

/**
 * Prepare one photo, or return null to store the original untouched.
 *
 * Never throws: every failure path returns null, because the caller's job is
 * to save the shopkeeper's photo and this is only an improvement on the way.
 */
export async function prepareProductPhoto(
  input: Buffer,
  contentType: string,
): Promise<PreparedPhoto | null> {
  if (!canPrepare(contentType)) return null;

  try {
    const image = sharp(input, { failOn: "none" }).rotate();
    const meta = await image.metadata();

    // rotate() applies the EXIF flag, so after it the long edge may have
    // swapped. Read the orientation to know which way round the numbers are.
    const turned = (meta.orientation ?? 1) >= 5;
    const width = turned ? meta.height : meta.width;
    const height = turned ? meta.width : meta.height;

    if (!width || !height) return null;

    const longest = Math.max(width, height);

    // Enlarge only to what the shop draws, and never more than 2x — past that
    // the result looks soft rather than sharp, and the honest answer is a
    // better photograph, which the Add photos screen asks for.
    const edge = Math.min(TARGET_EDGE, Math.max(longest, Math.min(longest * 2, TARGET_EDGE)));

    const bytes = await image
      .resize(edge, edge, {
        // `contain` fits the whole picture inside the square and fills the
        // rest — nothing is cut off.
        fit: "contain",
        background: PAPER,
        // Do not blow a tiny image up to fill the frame; the cap above already
        // decided how far it may grow.
        withoutEnlargement: false,
      })
      .webp({ quality: 82 })
      .toBuffer();

    // If the result is somehow larger than what arrived and no enlargement was
    // wanted, the original is the better file. Keep it.
    if (bytes.length >= input.length && longest >= TARGET_EDGE) return null;

    return {
      bytes,
      contentType: "image/webp",
      extension: "webp",
      note: describe(input.length, bytes.length, longest, edge),
      width: edge,
      height: edge,
      originalBytes: input.length,
    };
  } catch {
    // A corrupt or unusual file is stored as it came. See the note above.
    return null;
  }
}

function describe(before: number, after: number, wasEdge: number, nowEdge: number) {
  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;
  const parts = [`squared to ${nowEdge}px`];

  if (nowEdge > wasEdge) parts.push(`enlarged from ${wasEdge}px`);
  if (after < before) parts.push(`${kb(before)} to ${kb(after)}`);
  else if (after > before) parts.push(`${kb(before)} to ${kb(after)}, for the larger frame`);

  return parts.join(", ");
}
