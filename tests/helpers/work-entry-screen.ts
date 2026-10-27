import { readFile } from "node:fs/promises";

const DIR = "app/admin/factory/add-work";

/**
 * The work-entry screen as one text, in the order it is drawn.
 *
 * The form was split into parts on 2026-10-27 (the owner's audit: smaller files,
 * the same screen). The tests that read the form were written against one
 * file, and several read it in order — "the colour box comes before the size
 * box", "the save asks before it writes". So each part's source is put back in
 * front of the place the form draws it, and those tests read the screen exactly
 * as before, every line of it still checked.
 */
const PARTS: Array<[tag: string, file: string]> = [
  ["<SavedStrip", "SavedStrip.tsx"],
  ["<ColourField", "ColourField.tsx"],
  ["<SizeField", "SizeField.tsx"],
  ["<ConfirmSave", "ConfirmSave.tsx"],
  ["<AddProductDialog", "WorkEntryDialogs.tsx"],
];

export async function readWorkEntryScreen({ crlf = false }: { crlf?: boolean } = {}) {
  const normal = (text: string) => (crlf ? text : text.replace(/\r\n/g, "\n"));
  let screen = normal(await readFile(`${DIR}/WorkEntryForm.tsx`, "utf8"));
  // The shared box classes, where the form used to define them.
  screen = normal(await readFile(`${DIR}/work-entry-styles.ts`, "utf8")) + "\n" + screen;
  for (const [tag, file] of PARTS) {
    const at = screen.indexOf(`${tag}\n`) >= 0 ? screen.indexOf(`${tag}\n`) : screen.indexOf(`${tag}\r\n`);
    if (at < 0) throw new Error(`The form no longer draws ${tag}`);
    const part = normal(await readFile(`${DIR}/${file}`, "utf8"));
    screen = `${screen.slice(0, at)}${part}\n${screen.slice(at)}`;
  }
  return screen;
}
