import type { Metadata } from "next";
import WorkEntryForm from "@/app/admin/factory/add-work/WorkEntryForm";
import LoadFailure from "@/components/admin/LoadFailure";
import type { FactoryWorker } from "@/lib/factory-board";
import type { FactoryRate } from "@/lib/factory-rate-book";
import {
  getFactoryItems,
  getFactoryRateBook,
  getFactoryWorkers,
  type WorkOrderOption,
} from "@/lib/factory-board-data";
import { queryPostgres } from "@/lib/postgres/client";
import { stageNeedingUpperFirst } from "@/lib/stage-order";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Add work | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type Loaded = {
  workers: FactoryWorker[] | null;
  items: {
    id: string;
    name: string;
    /** Uppers made for this shoe with no bottom on them yet, net of QC. */
    uppersWaiting: number;
    code: string | null;
    sizes: string[];
    production_item_id: string | null;
  }[];
  workOrders: WorkOrderOption[];
  rates: FactoryRate[];
  error: string;
};

/**
 * Everything the work-entry screen needs, read together before it is drawn.
 *
 * This is the screen the factory opens fifty times a morning. It used to fetch
 * the team and the item list after arriving — an empty form, then a wait — and
 * then ask the server again for a rate every time a worker and an item were
 * picked. The rate book comes down whole now, so choosing an item prices the
 * work with no round trip at all.
 */
async function loadEntryScreen(): Promise<Loaded> {
  try {
    const [workers, catalogue, rates, stageWork] = await Promise.all([
      getFactoryWorkers({ workerType: "piece_rate" }),
      getFactoryItems(),
      getFactoryRateBook(),
      // How many uppers are waiting for a bottom, per shoe.
      //
      // The dropdown offers every active item with nothing to tell them apart,
      // so choosing one for bottom work is a guess: five have sixty uppers
      // waiting, two have had every upper fitted, and nine have never had an
      // upper cut. The count belongs where the choice is made.
      //
      // Net of rejects, matching the ready screen and the save guard — a pair
      // that failed QC is not an upper waiting for a bottom, and a third answer
      // here would be a third number for one question.
      queryPostgres<{ item_id: string; stage: string; net: number | string }>(
        "factory",
        `SELECT work.item_id,
                COALESCE(NULLIF(work.stage, ''), workers.category) AS stage,
                SUM(work.pairs_count - COALESCE(work.reject_pairs, 0))::integer AS net
         FROM factory_daily_work work
         JOIN factory_workers workers ON workers.id = work.worker_id
         WHERE work.status <> 'Reversed'
         GROUP BY work.item_id, COALESCE(NULLIF(work.stage, ''), workers.category)`,
      ).catch(() => []),
    ]);

    // Uppers made, less the bottoms already fitted to them. Sixty uppers with
    // sixty bottoms on them is nothing waiting, not sixty — which is bagopen's
    // state today.
    const waitingByItem = new Map<string, number>();
    for (const row of stageWork) {
      const pairs = Math.max(0, Number(row.net) || 0);
      const stage = (row.stage ?? "").trim();
      const running = waitingByItem.get(row.item_id) ?? 0;

      if (stage === "Upper") waitingByItem.set(row.item_id, running + pairs);
      else if (stageNeedingUpperFirst(stage)) waitingByItem.set(row.item_id, running - pairs);
    }

    return {
      workers,
      items: catalogue.items.map((item) => ({
        id: item.id,
        name: item.name,
        // Never negative: more bottoms than uppers is a typing slip, and a
        // minus beside a shoe name reads as nonsense on the factory floor.
        uppersWaiting: Math.max(0, waitingByItem.get(item.id) ?? 0),
        code: item.code,
        // The sizes this shoe is made in, so the form offers its real run
        // rather than a list written into the code.
        sizes: item.sizes,
        production_item_id: item.production_item_id,
      })),
      workOrders: catalogue.workOrders,
      rates,
      error: "",
    };
  } catch (error) {
    reportError("load the work entry screen", error);
    return {
      workers: null,
      items: [],
      workOrders: [],
      rates: [],
      error: saveFailureMessage(error, "Could not load the work entry screen."),
    };
  }
}

export default async function FactoryAddWorkPage() {
  const loaded = await loadEntryScreen();

  if (!loaded.workers) {
    return (
      <LoadFailure
        what="the work entry screen"
        message={loaded.error}
        retryHref="/admin/factory/add-work"
      />
    );
  }

  return (
    <WorkEntryForm
      initialWorkers={loaded.workers}
      initialItems={loaded.items}
      initialWorkOrders={loaded.workOrders}
      initialRates={loaded.rates}
    />
  );
}
