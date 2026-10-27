import { readFile } from "node:fs/promises";

const DIR = "app/admin/pos/_components";

/**
 * The counter bill's form and the small parts split out of it on 2026-10-27
 * (the owner's audit: smaller files, the same screen), as one text. The tests
 * that read the bill check what is on it, not which file holds it.
 */
export async function readPosScreen() {
  const [form, parts] = await Promise.all([
    readFile(`${DIR}/PosBillForm.tsx`, "utf8"),
    readFile(`${DIR}/PosBillParts.tsx`, "utf8"),
  ]);
  return `${form}\n${parts}`.replace(/\r\n/g, "\n");
}
