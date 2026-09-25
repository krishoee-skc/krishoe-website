import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { del, list, put } from "@vercel/blob";
import { buildAdminBackup } from "@/lib/backup";
import { nepalDate } from "@/lib/format-date";

/**
 * A copy of the shop's books every week, kept without anyone remembering to.
 *
 * "Export backup" in Activity works, and depends on the owner pressing it.
 * This makes the same backup on its own once a week and keeps the last eight —
 * two months to go back to if something is deleted or goes wrong.
 *
 * The file store is the one product photos live in, which serves anything in
 * it to whoever has the link. A backup holds password hashes, customers'
 * phones and addresses, so it is never stored as it is: it is compressed and
 * locked (AES-256-GCM) with BACKUP_ENCRYPTION_KEY, which lives only in the
 * hosting settings. A stored file on its own is unreadable noise; the admin's
 * download unlocks it on the server for the Owner only.
 *
 * If the key is ever lost the stored copies cannot be opened — so the key
 * belongs in the hosting settings and nowhere it can be casually changed.
 */

const PREFIX = "backups/";
const MAGIC = Buffer.from("KRBK1");
const KEEP = 8;
/** A little under a week, so a run a few minutes early is not a week late. */
const EVERY_MS = 6.5 * 24 * 60 * 60 * 1000;

export type StoredBackup = { url: string; pathname: string; size: number; uploadedAt: string };

export type BackupRun =
  | { outcome: "ok"; summary: string; pathname: string }
  | { outcome: "skipped"; summary: string }
  | { outcome: "failed"; summary: string };

/** The 32-byte key, or null when it has not been set up. */
export function backupKey(): Buffer | null {
  const value = process.env.BACKUP_ENCRYPTION_KEY?.trim();
  if (!value) return null;
  const key = Buffer.from(value, "base64");
  return key.length === 32 ? key : null;
}

/** Compress, then lock. Layout: "KRBK1" | 12-byte IV | 16-byte tag | ciphertext. */
export function sealBackup(json: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(json, "utf8"))), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), body]);
}

/** Unlock, then decompress. Throws if the file is not ours or was altered. */
export function openBackup(sealed: Buffer, key: Buffer): string {
  if (sealed.length < MAGIC.length + 28 || !sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("This is not a KRISHOE backup file.");
  }
  const iv = sealed.subarray(MAGIC.length, MAGIC.length + 12);
  const tag = sealed.subarray(MAGIC.length + 12, MAGIC.length + 28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const zipped = Buffer.concat([decipher.update(sealed.subarray(MAGIC.length + 28)), decipher.final()]);
  return gunzipSync(zipped).toString("utf8");
}

function storeReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/** The stored backups, newest first. */
export async function listStoredBackups(): Promise<StoredBackup[]> {
  if (!storeReady()) return [];
  const { blobs } = await list({ prefix: PREFIX, limit: 100 });
  return blobs
    .map((blob) => ({
      url: blob.url,
      pathname: blob.pathname,
      size: blob.size,
      uploadedAt: new Date(blob.uploadedAt).toISOString(),
    }))
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

/**
 * Makes this week's backup if it is due — or now, when the Owner asks
 * (`force`). The nightly job calls it every night; on six nights of seven it
 * only sees that the newest copy is recent and stops.
 */
export async function runScheduledBackup({ force = false } = {}): Promise<BackupRun> {
  const key = backupKey();
  if (!key) {
    return { outcome: "skipped", summary: "Skipped: BACKUP_ENCRYPTION_KEY is not set in the hosting settings." };
  }
  if (!storeReady()) {
    return { outcome: "skipped", summary: "Skipped: the file store (BLOB_READ_WRITE_TOKEN) is not set up." };
  }

  const stored = await listStoredBackups();
  const newest = stored[0];
  if (!force && newest && Date.now() - new Date(newest.uploadedAt).getTime() < EVERY_MS) {
    return {
      outcome: "skipped",
      summary: `Skipped: the latest backup (${nepalDate(newest.uploadedAt)}) is less than a week old.`,
    };
  }

  const backup = await buildAdminBackup();
  const sealed = sealBackup(JSON.stringify(backup), key);
  const day = new Date().toISOString().slice(0, 10);
  const saved = await put(`${PREFIX}krishoe-backup-${day}.krbk`, sealed, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/octet-stream",
  });

  // Keep the newest eight, this one included.
  const older = [{ pathname: saved.pathname }, ...stored].slice(KEEP);
  if (older.length) await del(older.map((blob) => blob.pathname));

  return {
    outcome: "ok",
    pathname: saved.pathname,
    summary: `Backup saved: ${megabytes(sealed.length)}, locked. ${Math.min(stored.length + 1, KEEP)} kept.`,
  };
}
