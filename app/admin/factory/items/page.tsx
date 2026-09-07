import type { Metadata } from "next";
import ItemList from "@/app/admin/factory/items/ItemList";
import LoadFailure from "@/components/admin/LoadFailure";
import {
  getFactoryItems,
  type FactoryItem,
  type ProductionItemOption,
} from "@/lib/factory-board-data";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";

export const metadata: Metadata = {
  title: "Factory items | KRISHOE Admin",
};

export const dynamic = "force-dynamic";

async function loadItems(): Promise<{
  items: FactoryItem[] | null;
  productionItems: ProductionItemOption[];
  error: string;
}> {
  try {
    // Retired items included: this is the only screen that can bring one back,
    // and everywhere else they stay hidden.
    const { items, productionItems } = await getFactoryItems({ includeRetired: true });
    return { items, productionItems, error: "" };
  } catch (error) {
    reportError("load the factory items", error);
    return {
      items: null,
      productionItems: [],
      error: saveFailureMessage(error, "Could not load the factory items."),
    };
  }
}

export default async function FactoryItemsPage() {
  const loaded = await loadItems();

  if (!loaded.items) {
    return (
      <LoadFailure
        what="the factory items"
        message={loaded.error}
        retryHref="/admin/factory/items"
      />
    );
  }

  return <ItemList initialItems={loaded.items} initialProductionItems={loaded.productionItems} />;
}
