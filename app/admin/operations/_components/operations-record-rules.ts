import type { OperationsSnapshot } from "@/app/admin/operations/_components/types";
import type { LedgerTransactionType, StockMovement, StockMovementType } from "@/lib/operations";

/**
 * What the operations records mean, apart from how they are drawn.
 *
 * OperationsRecords.tsx was 1,062 lines in one component, and — alone among
 * the big admin screens — nothing tested it. Seven decisions sat in there with
 * the markup: six that turn a status into a colour, and one that works out
 * where a stock movement came from.
 *
 * The last is not a colour. It is the answer to "who moved these pairs", read
 * off a note and a type in a fixed order, and it is what the stock ledger
 * shows the owner. It had nothing checking it at all.
 *
 * Nothing here draws anything. It is the same code, in a file that says what
 * it is, and now in one a test can reach.
 */

export function stockMovementTypeClass(type: StockMovementType) {
  if (type === "Production In" || type === "Purchase In" || type === "Return In") {
    return "bg-brand-green-tint text-brand-green";
  }

  if (type === "Dispatch Out" || type === "Sale Out" || type === "Market Sale") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-brand-mist text-brand-muted-deep";
}

export function stockSignalClass(signal: string) {
  if (signal === "Healthy") return "bg-brand-green-tint text-brand-green";
  if (signal === "Return watch") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

export function stockLedgerSignalClass(signal: string) {
  if (signal === "Balanced") return "bg-brand-green-tint text-brand-green";
  if (signal === "Watch") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

export function collectionPriorityClass(priority: string) {
  if (priority === "Clear") return "bg-brand-green-tint text-brand-green";
  if (priority === "Monitor" || priority === "Medium") return "bg-brand-cream-soft text-brand-gold-ink";
  return "bg-brand-clay-tint text-brand-clay";
}

export function ledgerTransactionTypeClass(type: LedgerTransactionType) {
  if (type === "Cash Payment" || type === "Cheque Payment") {
    return "bg-brand-green-tint text-brand-green";
  }

  if (type === "Credit Sale") {
    return "bg-brand-cream-soft text-brand-gold-ink";
  }

  return "bg-brand-mist text-brand-muted-deep";
}

export function agingClass(bucket: string) {
  if (bucket === "60+ days") {
    return "text-brand-clay";
  }

  if (bucket === "31-60 days") {
    return "text-brand-gold-ink";
  }

  return "text-brand-green";
}

export function stockMovementSource(
  movement: StockMovement,
  linkedItem?: OperationsSnapshot["vehicleDispatchItems"][number],
) {
  if (linkedItem) {
    return {
      label: linkedItem.vehicleNumber,
      detail: linkedItem.marketRoute || "Dispatch item",
    };
  }

  const note = movement.note.toLowerCase();

  if (note.includes("kr-bill") || note.includes("kr-rt")) {
    return {
      label: "POS billing",
      detail: "Invoice posting",
    };
  }

  if (movement.type === "Production In") {
    return {
      label: "Production",
      detail: "Factory output",
    };
  }

  if (movement.type === "Purchase In") {
    return {
      label: "Purchase",
      detail: "Trading goods received",
    };
  }

  if (movement.type === "Adjustment") {
    return {
      label: "Adjustment",
      detail: "Manual correction",
    };
  }

  return {
    label: "Manual",
    detail: "Direct entry",
  };
}
