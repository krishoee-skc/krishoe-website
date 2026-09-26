import type { Metadata } from "next";
import WorkEntryForm from "@/app/admin/factory/add-work/WorkEntryForm";
import LoadFailure from "@/components/admin/LoadFailure";
import type { FactoryWorker } from "@/lib/factory-board";
import type { FactoryRate } from "@/lib/factory-rate-book";
import {
  getFactoryItems,
  getFactoryRateBook,
  getFactoryWorkers,
} from "@/lib/factory-board-data";
import { queryPostgres } from "@/lib/postgres/client";
import { stageNeedingUpperFirst } from "@/lib/stage-order";
import { colourKey } from "@/lib/colour-name";
import { sizeRunKey } from "@/lib/shoe-sizes";
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
    /** The same, split by the colour and size run they were made in. */
    waitingRuns: { colour: string; sizeRun: string; pairs: number }[];
    code: string | null;
    sizes: string[];
    production_item_id: string | null;
  }[];
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
      queryPostgres<{
        item_id: string;
        stage: string;
        colour: string | null;
        size: string | null;
        net: number | string;
      }>(
        "factory",
        `SELECT work.item_id,
                COALESCE(NULLIF(work.stage, ''), workers.category) AS stage,
                work.color AS colour, work.size,
                SUM(work.pairs_count - COALESCE(work.reject_pairs, 0))::integer AS net
         FROM factory_daily_work work
         JOIN factory_workers workers ON workers.id = work.worker_id
         WHERE work.status <> 'Reversed'
         GROUP BY work.item_id, COALESCE(NULLIF(work.stage, ''), workers.category),
                  work.color, work.size`,
      ).catch(() => []),
    ]);

    // Uppers made, less the bottoms already fitted to them. Sixty uppers with
    // sixty bottoms on them is nothing waiting, not sixty — which is bagopen's
    // state today.
    // Held per item *and* per colour and size run, because that is what the
    // save guard matches on. A total across colours could not agree with it:
    // sixty black uppers and forty cherry would show "100 waiting" and then
    // warn at sixty — the screen saying one thing and the save another, about
    // the same pairs on the same click.
    //
    // Keyed through the same two helpers the guard uses, so "Black" and "black"
    // are one colour here too rather than two half-sized batches.
    const waitingByRun = new Map<
      string,
      { itemId: string; colour: string; sizeRun: string; pairs: number }
    >();

    for (const row of stageWork) {
      const pairs = Math.max(0, Number(row.net) || 0);
      const stage = (row.stage ?? "").trim();
      const colour = (row.colour ?? "").trim();
      const sizeRun = (row.size ?? "").trim();
      const key = `${row.item_id}|${colourKey(colour)}|${sizeRunKey(sizeRun)}`;

      const running = waitingByRun.get(key) ?? { itemId: row.item_id, colour, sizeRun, pairs: 0 };

      if (stage === "Upper") running.pairs += pairs;
      else if (stageNeedingUpperFirst(stage)) running.pairs -= pairs;
      else continue;

      waitingByRun.set(key, running);
    }

    // Only the runs that still have uppers free. A run whose bottoms are all
    // fitted is not waiting for anything and would only lengthen the list.
    const runsByItem = new Map<string, { colour: string; sizeRun: string; pairs: number }[]>();
    for (const run of waitingByRun.values()) {
      if (run.pairs <= 0) continue;
      const list = runsByItem.get(run.itemId) ?? [];
      list.push({ colour: run.colour, sizeRun: run.sizeRun, pairs: run.pairs });
      runsByItem.set(run.itemId, list);
    }

    return {
      workers,
      items: catalogue.items.map((item) => ({
        id: item.id,
        name: item.name,
        // The total, for the one-line label on the option. Never negative:
        // more bottoms than uppers is a typing slip, and a minus beside a shoe
        // name reads as nonsense on the factory floor.
        uppersWaiting: (runsByItem.get(item.id) ?? []).reduce((sum, run) => sum + run.pairs, 0),
        // And the split, so the screen can name the colour rather than only
        // counting it — the owner's own question about barmi buckl's sixty.
        waitingRuns: runsByItem.get(item.id) ?? [],
        code: item.code,
        // The sizes this shoe is made in, so the form offers its real run
        // rather than a list written into the code.
        sizes: item.sizes,
        production_item_id: item.production_item_id,
      })),
      rates,
      error: "",
    };
  } catch (error) {
    reportError("load the work entry screen", error);
    return {
      workers: null,
      items: [],
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
      initialRates={loaded.rates}
    />
  );
}
