// What a POS bill line is still missing, named field by field, so the counter
// form can light up the exact box before the cashier presses Save — the same
// rule the purchase form uses, shaped for a sale line.
//
// A sale line needs a design (what is being sold), a quantity, and a rate. SKU,
// size and a line discount are optional. Kept pure so it is tested and so the
// on-screen red and the server's own read cannot drift apart.

export type PosLineDraft = {
  sku: string;
  design: string;
  quantity: string;
  rate: string;
};

export type PosLineIssue = {
  design: boolean;
  quantity: boolean;
  rate: boolean;
  message: string;
};

// Started the moment any field is touched — a rate typed with no design lights
// up the design box at once, rather than after a save that threw the bill away.
export function posLineIsStarted(line: PosLineDraft) {
  return Boolean(line.sku || line.design || line.quantity || line.rate);
}

function joinAnd(parts: string[]) {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

export function posLineIssue(line: PosLineDraft): PosLineIssue | null {
  if (!posLineIsStarted(line)) {
    return null;
  }

  const quantity = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;

  const issue: PosLineIssue = {
    design: !line.design,
    quantity: quantity <= 0,
    rate: rate <= 0,
    message: "",
  };

  const missing: string[] = [];
  if (issue.design) missing.push("a design");
  if (issue.quantity) missing.push("a quantity");
  if (issue.rate) missing.push("a rate");

  if (missing.length === 0) {
    return null;
  }

  issue.message = `This line still needs ${joinAnd(missing)}.`;
  return issue;
}
