import sharp from "sharp";
import { isAiConfigured, type AskImage } from "@/lib/ai/gemini";
import { guessFromPhoto } from "@/lib/ai/photo-guess";
import { getFactoryItems } from "@/lib/factory-board-data";
import { reportError } from "@/lib/report-error";
import {
  factoryItemHistory,
  getWorkerPhoto,
  photoRobotOn,
  robotExamplePhotos,
  saveRobotGuess,
  type RobotGuess,
} from "@/lib/worker-portal";

/**
 * The robot looks at a worker's photo and keeps its guess beside it (owner,
 * 2026-10-03). Runs after the worker's send has been answered, so a slow or
 * absent robot never holds the worker up; it never throws, and with no key,
 * the switch off or the day's free limit spent, the photo simply has no guess.
 */

/** A small copy for the robot: the stored photo stays as it is. */
async function small(url: string, side: number): Promise<AskImage | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) return null;
    const bytes = await sharp(Buffer.from(await response.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize(side, side, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return { mimeType: "image/jpeg", data: bytes.toString("base64") };
  } catch {
    return null;
  }
}

export async function robotLookAtPhoto(photoId: string, options: { force?: boolean } = {}): Promise<RobotGuess | null> {
  try {
    if (!isAiConfigured()) return null;
    if (!(await photoRobotOn())) return null;
    const photo = await getWorkerPhoto(photoId);
    if (!photo || photo.kind === "problem" || photo.status === "added") return null;
    if (photo.robot && !photo.robot.missing && !options.force) return photo.robot;

    const [loaded, history, examples, picture] = await Promise.all([
      getFactoryItems().catch(() => ({ items: [] })),
      factoryItemHistory(),
      robotExamplePhotos(),
      small(photo.imageUrl, 768),
    ]);
    if (!picture) return null;
    const shoes = await Promise.all(
      loaded.items.slice(0, 12).map(async (item) => {
        const example = examples.find((row) => row.itemId === item.id && row.imageUrl !== photo.imageUrl);
        return { id: item.id, name: item.name, example: example ? ((await small(example.imageUrl, 384)) ?? undefined) : undefined };
      }),
    );
    const colours = [...new Set(Object.values(history).flatMap((known) => known.colors))].slice(0, 20);

    const { guess, missing } = await guessFromPhoto({ photo: picture, shoes, colours });
    const saved: RobotGuess = {
      itemId: guess?.itemId ?? "",
      color: guess?.color ?? "",
      pairs: guess?.pairs ?? null,
      sureItem: guess?.sureItem ?? "",
      sureColor: guess?.sureColor ?? "",
      ...(missing ? { missing } : {}),
      at: new Date().toISOString(),
    };
    await saveRobotGuess(photo.id, saved);
    return saved;
  } catch (error) {
    reportError(`robot look at worker photo ${photoId}`, error);
    return null;
  }
}
