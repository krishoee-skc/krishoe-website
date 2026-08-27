import { randomUUID } from "node:crypto";
import { queryPostgres, transactionPostgres } from "@/lib/postgres/client";

const STORE = "stock transfers";

export type StockPlace = "Factory" | "Shop";
export type TransferStatus = "Sent" | "Received" | "Cancelled";
/** The same three words the factory floor already uses for a stage handover. */
export type TransferSignal = "Matched" | "Short" | "Excess";

export const stockPlaces: StockPlace[] = ["Factory", "Shop"];

export type StockAtPlace = {
  design: string;
  sizeRun: string;
  factory: number;
  shop: number;
  /** What finished_stock says the design holds in total, however it is split. */
  total: number;
  /**
   * total − (factory + shop). Nonzero means pairs exist that nobody has said
   * where they are — a design made or bought before this screen existed, or a
   * count that has drifted. Shown rather than hidden: a location figure that
   * quietly disagrees with the stock figure is worse than no location figure.
   */
  unplaced: number;
};

export type TransferItem = {
  id: string;
  design: string;
  sizeRun: string;
  sentPairs: number;
  receivedPairs: number | null;
};

export type StockTransfer = {
  id: string;
  challanNumber: string;
  createdAt: string;
  sentDate: string;
  fromLocation: StockPlace;
  toLocation: StockPlace;
  sentBy: string;
  carriedBy: string;
  note: string;
  status: TransferStatus;
  receivedAt: string | null;
  receivedBy: string;
  sentPairs: number;
  receivedPairs: number;
  signal: TransferSignal | null;
  items: TransferItem[];
};

type TransferRow = {
  id: string;
  challan_number: string;
  created_at: Date | string;
  sent_date: Date | string;
  from_location: string;
  to_location: string;
  sent_by: string;
  carried_by: string;
  note: string;
  status: string;
  received_at: Date | string | null;
  received_by: string;
  sent_pairs: number | string;
  received_pairs: number | string;
  signal: string | null;
};

type ItemRow = {
  id: string;
  transfer_id: string;
  design: string;
  size_run: string;
  sent_pairs: number | string;
  received_pairs: number | string | null;
};

function whole(value: unknown) {
  const parsed = Math.round(Number(value) ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function place(value: unknown): StockPlace {
  return value === "Shop" ? "Shop" : "Factory";
}

/** A DATE column as the day it says. See the note on dbDate in factory-mutations. */
function dayOf(value: Date | string | null) {
  if (!value) return "";
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function isoOf(value: Date | string | null) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function transferFromRow(row: TransferRow, items: TransferItem[]): StockTransfer {
  return {
    id: row.id,
    challanNumber: row.challan_number,
    createdAt: isoOf(row.created_at) ?? "",
    sentDate: dayOf(row.sent_date),
    fromLocation: place(row.from_location),
    toLocation: place(row.to_location),
    sentBy: row.sent_by ?? "",
    carriedBy: row.carried_by ?? "",
    note: row.note ?? "",
    status: row.status === "Received" ? "Received" : row.status === "Cancelled" ? "Cancelled" : "Sent",
    receivedAt: isoOf(row.received_at),
    receivedBy: row.received_by ?? "",
    sentPairs: whole(row.sent_pairs),
    receivedPairs: whole(row.received_pairs),
    signal:
      row.signal === "Short" || row.signal === "Excess" || row.signal === "Matched" ? row.signal : null,
    items,
  };
}

/**
 * What the two places hold, design by design, beside what stock says in total.
 *
 * Left-joined from finished_stock rather than from stock_locations, so a design
 * that has never been placed still appears — with its pairs counted as
 * unplaced, which is the honest answer and the prompt to fix it.
 */
export async function getStockByPlace(): Promise<StockAtPlace[]> {
  const rows = await queryPostgres<{
    design: string;
    size_run: string;
    factory: number | string;
    shop: number | string;
    total: number | string;
  }>(
    STORE,
    // One join per place rather than one join and a FILTER. stock_locations is
    // unique on (design, size_run, location), so each of these matches at most
    // one row and the total cannot be multiplied by how many places a design
    // happens to sit in — which is what a single join did: two location rows
    // counted a 54-pair design as 108.
    `SELECT
       s.design,
       s.size_run,
       s.stock_pairs AS total,
       coalesce(f.pairs, 0) AS factory,
       coalesce(p.pairs, 0) AS shop
     FROM (
       SELECT design, size_run, sum(stock_pairs)::int AS stock_pairs
       FROM finished_stock
       GROUP BY design, size_run
     ) s
     LEFT JOIN stock_locations f
       ON f.design = s.design AND f.size_run = s.size_run AND f.location = 'Factory'
     LEFT JOIN stock_locations p
       ON p.design = s.design AND p.size_run = s.size_run AND p.location = 'Shop'
     ORDER BY s.design, s.size_run
     LIMIT 500`,
  );

  return rows.map((row) => {
    const factory = whole(row.factory);
    const shop = whole(row.shop);
    const total = whole(row.total);
    return {
      design: row.design,
      sizeRun: row.size_run,
      factory,
      shop,
      total,
      unplaced: total - factory - shop,
    };
  });
}

/** The challans, newest first, with their lines. */
export async function getStockTransfers(limit = 60): Promise<StockTransfer[]> {
  const transfers = await queryPostgres<TransferRow>(
    STORE,
    `SELECT id, challan_number, created_at, sent_date, from_location, to_location,
            sent_by, carried_by, note, status, received_at, received_by,
            sent_pairs, received_pairs, signal
     FROM stock_transfers
     ORDER BY sent_date DESC, created_at DESC
     LIMIT $1`,
    [Math.min(Math.max(1, limit), 200)],
  );

  if (transfers.length === 0) return [];

  const items = await queryPostgres<ItemRow>(
    STORE,
    `SELECT id, transfer_id, design, size_run, sent_pairs, received_pairs
     FROM stock_transfer_items
     WHERE transfer_id = ANY($1::text[])
     ORDER BY design`,
    [transfers.map((row) => row.id)],
  );

  const byTransfer = new Map<string, TransferItem[]>();
  for (const item of items) {
    const list = byTransfer.get(item.transfer_id) ?? [];
    list.push({
      id: item.id,
      design: item.design,
      sizeRun: item.size_run,
      sentPairs: whole(item.sent_pairs),
      receivedPairs: item.received_pairs === null ? null : whole(item.received_pairs),
    });
    byTransfer.set(item.transfer_id, list);
  }

  return transfers.map((row) => transferFromRow(row, byTransfer.get(row.id) ?? []));
}

export async function getStockTransferById(id: string) {
  const transfers = await getStockTransfers(200);
  return transfers.find((transfer) => transfer.id === id) ?? null;
}

async function nextChallanNumber(db: { query: <T extends Record<string, unknown>>(sql: string, params?: never[] | (string | number)[]) => Promise<T[]> }, sentDate: string) {
  const day = sentDate.replaceAll("-", "");
  const rows = await db.query<{ used: string | null }>(
    `SELECT max(challan_number) AS used
     FROM stock_transfers
     WHERE challan_number LIKE $1`,
    [`KR-CHA-${day}-%`],
  );
  const previous = Number(rows[0]?.used?.split("-").pop() ?? 0);
  const next = Number.isFinite(previous) ? previous + 1 : 1;
  return `KR-CHA-${day}-${String(next).padStart(2, "0")}`;
}

export type CreateTransferInput = {
  sentDate: string;
  fromLocation: StockPlace;
  toLocation: StockPlace;
  sentBy: string;
  carriedBy: string;
  note: string;
  /** The owner's tick: he carried the pairs himself, so nobody has to confirm. */
  receiveNow: boolean;
  submissionKey?: string;
  items: Array<{ design: string; sizeRun: string; pairs: number }>;
};

/**
 * Send a challan, and — when the same person is carrying the goods — receive it
 * in the same press.
 *
 * All of it in one transaction, each source row locked, so a challan can never
 * exist with the pairs still counted at the place they left.
 */
export async function createStockTransfer(input: CreateTransferInput) {
  const from = place(input.fromLocation);
  const to = place(input.toLocation);

  if (from === to) {
    throw new Error("A challan has to go from one place to the other.");
  }

  const lines = input.items
    .map((item) => ({
      design: item.design.trim(),
      sizeRun: item.sizeRun.trim() || "Mixed",
      pairs: whole(item.pairs),
    }))
    .filter((item) => item.design && item.pairs > 0);

  if (lines.length === 0) {
    throw new Error("Add at least one item, with how many pairs are going.");
  }

  const submissionKey = input.submissionKey?.trim() || null;

  return transactionPostgres(STORE, async (db) => {
    if (submissionKey) {
      const already = await db.query<TransferRow>(
        `SELECT id, challan_number, created_at, sent_date, from_location, to_location,
                sent_by, carried_by, note, status, received_at, received_by,
                sent_pairs, received_pairs, signal
         FROM stock_transfers WHERE submission_key = $1`,
        [submissionKey],
      );
      // A double tap on a slow connection must not send the same goods twice.
      if (already[0]) return transferFromRow(already[0], []);
    }

    const transferId = `trf-${randomUUID()}`;
    const challanNumber = await nextChallanNumber(db, input.sentDate);

    // The challan row goes in before its lines, because the lines point at it.
    // Its totals are written at the end, once the pairs are known.
    await db.query(
      `INSERT INTO stock_transfers (
         id, challan_number, sent_date, from_location, to_location, sent_by,
         carried_by, note, status, sent_pairs, received_pairs, submission_key
       ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, 'Sent', 0, 0, $9)`,
      [
        transferId,
        challanNumber,
        input.sentDate,
        from,
        to,
        input.sentBy.trim(),
        input.carriedBy.trim(),
        input.note.trim(),
        submissionKey,
      ],
    );

    let sentPairs = 0;

    for (const line of lines) {
      // FOR UPDATE: two people despatching the same design at once must not both
      // read the same "there are 60" and each send 40.
      const held = await db.query<{ id: string; pairs: number | string }>(
        `SELECT id, pairs FROM stock_locations
         WHERE design = $1 AND size_run = $2 AND location = $3
         FOR UPDATE`,
        [line.design, line.sizeRun, from],
      );
      const available = whole(held[0]?.pairs);

      if (line.pairs > available) {
        throw new Error(
          `${line.design}: ${from === "Factory" ? "the factory" : "the shop"} has ${available} pairs, so ${line.pairs} cannot go.`,
        );
      }

      await db.query(
        `UPDATE stock_locations SET pairs = pairs - $2, updated_at = now() WHERE id = $1`,
        [held[0].id, line.pairs],
      );

      await db.query(
        `INSERT INTO stock_transfer_items (id, transfer_id, design, size_run, sent_pairs, received_pairs)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `trfi-${randomUUID()}`,
          transferId,
          line.design,
          line.sizeRun,
          line.pairs,
          input.receiveNow ? line.pairs : null,
        ],
      );

      if (input.receiveNow) {
        await placePairs(db, line.design, line.sizeRun, to, line.pairs);
      }

      sentPairs += line.pairs;
    }

    // Now the pairs are counted, and the tick decides whether this challan is
    // already home or still on the road.
    const rows = await db.query<TransferRow>(
      `UPDATE stock_transfers
       SET sent_pairs = $2,
           received_pairs = $3,
           status = $4,
           received_at = $5,
           received_by = $6,
           signal = $7
       WHERE id = $1
       RETURNING id, challan_number, created_at, sent_date, from_location, to_location,
                 sent_by, carried_by, note, status, received_at, received_by,
                 sent_pairs, received_pairs, signal`,
      [
        transferId,
        sentPairs,
        input.receiveNow ? sentPairs : 0,
        input.receiveNow ? "Received" : "Sent",
        input.receiveNow ? new Date().toISOString() : null,
        input.receiveNow ? input.sentBy.trim() : "",
        input.receiveNow ? "Matched" : null,
      ],
    );

    return transferFromRow(rows[0], []);
  });
}

/** Add pairs to a place, creating the row the first time a design lands there. */
async function placePairs(
  db: { query: <T extends Record<string, unknown>>(sql: string, params?: (string | number)[]) => Promise<T[]> },
  design: string,
  sizeRun: string,
  location: StockPlace,
  pairs: number,
) {
  await db.query(
    `INSERT INTO stock_locations (id, design, size_run, location, pairs)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (design, size_run, location)
     DO UPDATE SET pairs = stock_locations.pairs + EXCLUDED.pairs, updated_at = now()`,
    [`loc-${randomUUID()}`, design, sizeRun, location, pairs],
  );
}

export type ReceiveTransferInput = {
  transferId: string;
  receivedBy: string;
  /** What was counted at the far end, by transfer item id. */
  counted: Record<string, number>;
};

/**
 * Count what arrived.
 *
 * What was counted is allowed to differ from what was sent, because sometimes
 * it does — and that difference is the finding, not an error to argue with. The
 * pairs that arrived are what lands at the far end; the ones that did not are
 * left off both places and shown as the challan's shortfall, so they stay
 * visible until somebody explains them.
 */
export async function receiveStockTransfer(input: ReceiveTransferInput) {
  return transactionPostgres(STORE, async (db) => {
    const transfers = await db.query<TransferRow>(
      `SELECT id, challan_number, created_at, sent_date, from_location, to_location,
              sent_by, carried_by, note, status, received_at, received_by,
              sent_pairs, received_pairs, signal
       FROM stock_transfers WHERE id = $1 FOR UPDATE`,
      [input.transferId],
    );
    const transfer = transfers[0];

    if (!transfer) throw new Error("That challan was not found.");
    if (transfer.status === "Received") {
      // Already counted. Answering with the challan rather than an error means a
      // second tap on a slow connection is harmless.
      return transferFromRow(transfer, []);
    }
    if (transfer.status === "Cancelled") {
      throw new Error("That challan was cancelled.");
    }

    const items = await db.query<ItemRow>(
      `SELECT id, transfer_id, design, size_run, sent_pairs, received_pairs
       FROM stock_transfer_items WHERE transfer_id = $1`,
      [transfer.id],
    );

    const to = place(transfer.to_location);
    let receivedPairs = 0;

    for (const item of items) {
      const sent = whole(item.sent_pairs);
      const raw = input.counted[item.id];
      const counted = raw === undefined ? sent : whole(raw);

      await db.query(`UPDATE stock_transfer_items SET received_pairs = $2 WHERE id = $1`, [
        item.id,
        counted,
      ]);

      if (counted > 0) {
        await placePairs(db, item.design, item.size_run, to, counted);
      }
      receivedPairs += counted;
    }

    const sentPairs = whole(transfer.sent_pairs);
    const signal: TransferSignal =
      receivedPairs === sentPairs ? "Matched" : receivedPairs < sentPairs ? "Short" : "Excess";

    const updated = await db.query<TransferRow>(
      `UPDATE stock_transfers
       SET status = 'Received', received_at = now(), received_by = $2,
           received_pairs = $3, signal = $4
       WHERE id = $1
       RETURNING id, challan_number, created_at, sent_date, from_location, to_location,
                 sent_by, carried_by, note, status, received_at, received_by,
                 sent_pairs, received_pairs, signal`,
      [transfer.id, input.receivedBy.trim(), receivedPairs, signal],
    );

    return transferFromRow(updated[0], []);
  });
}

/**
 * Set a place's count directly, for the first correction after this screen
 * appeared and for a stocktake afterwards.
 *
 * Deliberately not a transfer: nothing moved, somebody counted. A challan for a
 * correction would put goods on a road they never travelled.
 */
export async function setPlaceCount(input: {
  design: string;
  sizeRun: string;
  location: StockPlace;
  pairs: number;
}) {
  const design = input.design.trim();
  const sizeRun = input.sizeRun.trim() || "Mixed";

  if (!design) throw new Error("Which shoe is being counted?");

  return transactionPostgres(STORE, async (db) => {
    await db.query(
      `INSERT INTO stock_locations (id, design, size_run, location, pairs)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (design, size_run, location)
       DO UPDATE SET pairs = EXCLUDED.pairs, updated_at = now()`,
      [`loc-${randomUUID()}`, design, sizeRun, place(input.location), whole(input.pairs)],
    );
  });
}
