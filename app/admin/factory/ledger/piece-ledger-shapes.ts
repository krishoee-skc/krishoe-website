import type { FactoryWorker as Worker } from "@/lib/factory-board";

/**
 * What a piece-wage ledger is made of, apart from how it is drawn.
 *
 * PieceLedger.tsx was 849 lines in one client component: the shape of a ledger
 * line, the shape of a month's ledger, and the whole of the markup that draws
 * them. All of it shipped to the phone as one chunk, and these two shapes —
 * which describe money a worker has earned and been paid — could only be read
 * by reading past the screen.
 *
 * Nothing here draws anything or touches React. It is the same code, in a file
 * that says what it is.
 */

export interface WorkerLedger {
  id: string;
  date: string;
  entry_type: string;
  work_pairs: number;
  amount_earned: number;
  payment_given: number;
  running_balance: number;
  status: string;
  notes: string | null;
  /** Which shoe this wage was for, read through the work row. Null on a
   *  payment, and on work saved before that link existed. */
  item_name: string | null;
  color: string | null;
  size: string | null;
  rate_applied: number | string | null;
  reject_pairs: number | null;
  /** The factory_daily_work row this line came from, which is what a
   *  correction rewrites, and the item it was for. Null on a payment. */
  source_work_id: string | null;
  item_id: string | null;
}

export interface LedgerData {
  worker: Worker;
  ledger: WorkerLedger[];
  summary: {
    totalPairs: number;
    totalEarned: number;
    totalPaid: number;
    currentBalance: number;
  };
}
