import type { PurchaseKind } from "@/lib/purchasing";

// A purchase line as the form holds it, before anything is parsed: every field
// is a string, because that is what an input gives back.
export type PurchaseLineDraft = {
  kind: PurchaseKind;
  materialId: string;
  design: string;
  quantity: string;
  rate: string;
};

// Which fields on a started line are not yet filled, plus a plain-words note.
// The booleans light up the exact boxes; the message spells out what is left.
export type PurchaseLineIssue = {
  design: boolean;
  material: boolean;
  quantity: boolean;
  rate: boolean;
  message: string;
};

// A line counts as started the moment any of its fields is touched. A blank
// trailing line is ignored, not flagged — the owner has not begun it.
export function purchaseLineIsStarted(line: PurchaseLineDraft) {
  return Boolean(line.materialId || line.design || line.quantity || line.rate);
}

function joinAnd(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

// The whole point: name the missing field before the bill leaves the browser,
// so a quantity typed with no product picked says so on the product box, not
// after a round trip that used to throw the whole bill away.
export function purchaseLineIssue(line: PurchaseLineDraft): PurchaseLineIssue | null {
  if (!purchaseLineIsStarted(line)) {
    return null;
  }

  const trading = line.kind === "Trading Goods";
  const quantity = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;

  const issue: PurchaseLineIssue = {
    design: trading && !line.design,
    material: !trading && !line.materialId,
    quantity: quantity <= 0,
    rate: rate <= 0,
    message: "",
  };

  const missing: string[] = [];
  if (issue.design) missing.push("a product");
  if (issue.material) missing.push("a raw material");
  if (issue.quantity) missing.push("a quantity");
  if (issue.rate) missing.push("a rate");

  if (missing.length === 0) {
    return null;
  }

  issue.message = `This line still needs ${joinAnd(missing)}.`;
  return issue;
}
