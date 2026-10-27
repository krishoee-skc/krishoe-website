import { readFile } from "node:fs/promises";

const DIR = "app/admin/purchasing/_components";

/**
 * The purchase bill as one text, in the order it is drawn.
 *
 * The form was split into parts on 2026-10-27 (the owner's audit: smaller files,
 * the same screen). Each part's source is put back in front of the place the
 * form draws it, so the tests written against one file read the screen exactly
 * as before.
 */
const PARTS: Array<[tag: string, file: string]> = [
  ["<PurchasePayment", "PurchasePayment.tsx"],
  ["<PurchaseTotals", "PurchaseTotals.tsx"],
  ["<PurchaseReceipt", "PurchaseReceipt.tsx"],
];

export async function readPurchaseScreen() {
  let screen = (await readFile(`${DIR}/PurchaseInvoiceForm.tsx`, "utf8")).replace(/\r\n/g, "\n");
  for (const [tag, file] of PARTS) {
    const at = screen.indexOf(`${tag}\n`);
    if (at < 0) throw new Error(`The form no longer draws ${tag}`);
    const part = (await readFile(`${DIR}/${file}`, "utf8")).replace(/\r\n/g, "\n");
    screen = `${screen.slice(0, at)}${part}\n${screen.slice(at)}`;
  }
  return screen;
}
