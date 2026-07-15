import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

// Crash-safe, race-free writer for the local JSON data stores.
//
// Two problems this solves over a plain `fs.writeFile`:
//   1. Corruption on crash — `writeFile` truncates the target before writing,
//      so a crash mid-write leaves an empty or half-written file. We instead
//      write to a temp file and `rename` it into place, which is atomic on the
//      same filesystem: readers always see either the old or the new file.
//   2. Lost updates from concurrent read-modify-write — two overlapping request
//      handlers could both read, both mutate, and the second write clobbers the
//      first. We serialize writes per file path with an in-process promise
//      chain so they apply one at a time.
//
// This does NOT coordinate across multiple Node processes; for real
// multi-instance concurrency use DATA_BACKEND=postgres.

const writeQueues = new Map<string, Promise<unknown>>();
let tempCounter = 0;

// Windows can transiently fail a rename with EPERM/EACCES/EBUSY when an
// antivirus or file-indexer briefly holds the destination handle. Retry a few
// times with a short backoff before giving up.
const transientRenameCodes = new Set(["EPERM", "EACCES", "EBUSY"]);

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(from: string, to: string, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? "";

      if (attempt < attempts && transientRenameCodes.has(code)) {
        await delay(attempt * 20);
        continue;
      }

      throw error;
    }
  }
}

async function performAtomicWrite(filePath: string, contents: string) {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });

  tempCounter += 1;
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${tempCounter}.tmp`,
  );

  await writeFile(tempPath, contents, "utf8");
  await renameWithRetry(tempPath, filePath);
}

/**
 * Atomically write `contents` to `filePath`, creating parent directories as
 * needed. Writes to the same path are serialized so overlapping callers cannot
 * clobber one another. Drop-in replacement for a `mkdir` + `fs.writeFile` pair.
 */
export async function writeFileAtomic(filePath: string, contents: string) {
  const key = path.resolve(filePath);
  const previous = writeQueues.get(key) ?? Promise.resolve();

  // Chain onto any in-flight write for this path, swallowing the previous
  // error so one failed write does not reject unrelated queued writes.
  const next = previous
    .catch(() => {})
    .then(() => performAtomicWrite(filePath, contents));

  writeQueues.set(key, next);

  // Keep the queue map from leaking: once this write settles and nothing newer
  // has been chained on, drop the entry.
  next.finally(() => {
    if (writeQueues.get(key) === next) {
      writeQueues.delete(key);
    }
  }).catch(() => {});

  return next;
}
