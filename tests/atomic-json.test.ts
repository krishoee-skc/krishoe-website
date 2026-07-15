import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeFileAtomic } from "@/lib/atomic-json";

let dir = "";

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "krishoe-atomic-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeFileAtomic", () => {
  it("writes the given contents", async () => {
    const file = path.join(dir, "data.json");
    await writeFileAtomic(file, '{"ok":true}\n');
    expect(await readFile(file, "utf8")).toBe('{"ok":true}\n');
  });

  it("creates missing parent directories", async () => {
    const file = path.join(dir, "nested", "deep", "data.json");
    await writeFileAtomic(file, "1");
    expect(await readFile(file, "utf8")).toBe("1");
  });

  it("leaves no temp files behind", async () => {
    const file = path.join(dir, "data.json");
    await writeFileAtomic(file, "final");
    const entries = await readdir(dir);
    expect(entries).toEqual(["data.json"]);
  });

  it("serializes concurrent writes so the last one wins intact", async () => {
    const file = path.join(dir, "data.json");
    // Fire many overlapping writes; each writes a distinct full document.
    await Promise.all(
      Array.from({ length: 25 }, (_, i) => writeFileAtomic(file, `value-${i}`)),
    );
    const contents = await readFile(file, "utf8");
    // The file must be exactly one of the written values — never a mix of two.
    expect(contents).toMatch(/^value-\d+$/);
    // And no temp files should remain.
    const entries = await readdir(dir);
    expect(entries).toEqual(["data.json"]);
  });
});
