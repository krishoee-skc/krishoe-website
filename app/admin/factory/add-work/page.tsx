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
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Add work | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

type Loaded = {
  workers: FactoryWorker[] | null;
  items: { id: string; name: string; code: string | null; production_item_id: string | null }[];
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
    const [workers, catalogue, rates] = await Promise.all([
      getFactoryWorkers({ workerType: "piece_rate" }),
      getFactoryItems(),
      getFactoryRateBook(),
    ]);

    return {
      workers,
      items: catalogue.items.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
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
