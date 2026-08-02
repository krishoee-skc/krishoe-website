import Link from "next/link";
import LoadFailure from "@/components/admin/LoadFailure";
import { getOperationsData, type StockMovement } from "@/lib/operations";
import { getProducts } from "@/lib/product-store";
import { saveFailureMessage } from "@/lib/postgres/retryable";
import { reportError } from "@/lib/report-error";
import { buildStockOverview, type ReadyStockOverviewRow, type ReadyStockOrigin } from "@/lib/stock-overview";

export const metadata = { title: "Stock Control | KRISHOE Admin" };
export const dynamic = "force-dynamic";

function StatCard({ label, value, detail, tone = "plain" }: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "plain" | "good" | "warn";
}) {
  const valueTone = tone === "warn" ? "text-brand-clay" : tone === "good" ? "text-brand-green" : "text-brand-green-ink";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${valueTone}`}>{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-brand-muted-soft">{detail}</p>
    </div>
  );
}

const originStyle: Record<ReadyStockOrigin, { badge: string; panel: string; description: string }> = {
  Manufactured: {
    badge: "bg-emerald-100 text-emerald-800",
    panel: "border-emerald-200 bg-emerald-50/40",
    description: "Pairs completed by KRISHOE production and posted through Production In.",
  },
  Purchased: {
    badge: "bg-blue-100 text-blue-800",
    panel: "border-blue-200 bg-blue-50/40",
    description: "Ready-made pairs purchased from suppliers for resale.",
  },
  Mixed: {
    badge: "bg-amber-100 text-amber-900",
    panel: "border-amber-200 bg-amber-50/50",
    description: "This design has both factory-made and purchased inflow history.",
  },
  "Opening / Adjustment": {
    badge: "bg-gray-200 text-gray-800",
    panel: "border-gray-200 bg-gray-50",
    description: "Opening or adjusted stock without a Production In or Purchase In source movement.",
  },
};

function ReadyStockSection({ title, origin, rows }: { title: string; origin: ReadyStockOrigin; rows: ReadyStockOverviewRow[] }) {
  const style = originStyle[origin];
  const total = rows.reduce((sum, row) => sum + row.stockPairs, 0);

  return (
    <section className={`rounded-2xl border p-4 sm:p-5 ${style.panel}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-black text-brand-green-ink">{title}</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs font-black ${style.badge}`}>{total} pairs</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">{style.description}</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-[0.12em] text-gray-500">{rows.length} stock rows</span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white/70 p-4 text-sm font-semibold text-gray-500">No stock in this group.</p>
      ) : (
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/80 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-black text-brand-green-ink">{row.design}</p>
                  <p className="mt-1 text-xs font-semibold text-gray-500">{row.channel} · Size {row.sizeRun}</p>
                </div>
                <strong className="shrink-0 text-xl text-brand-green">{row.stockPairs}</strong>
              </div>
              <div className="mt-3 flex gap-4 border-t border-gray-100 pt-3 text-xs font-semibold text-gray-500">
                <span>Sold {row.soldPairs}</span>
                <span>Returned {row.returnedPairs}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function movementTone(type: StockMovement["type"]) {
  if (type === "Production In") return "bg-emerald-100 text-emerald-800";
  if (type === "Purchase In") return "bg-blue-100 text-blue-800";
  if (type === "Sale Out" || type === "Dispatch Out") return "bg-rose-100 text-rose-800";
  return "bg-gray-100 text-gray-700";
}

async function loadStock() {
  try {
    const [products, operations] = await Promise.all([
      getProducts({ includeDrafts: true }),
      getOperationsData(),
    ]);
    return { overview: buildStockOverview(operations, products), error: "" };
  } catch (error) {
    reportError("load unified stock control", error);
    return { overview: null, error: saveFailureMessage(error, "Could not load stock control.") };
  }
}

export default async function AdminStockPage() {
  const loaded = await loadStock();
  if (!loaded.overview) return <LoadFailure what="stock control" message={loaded.error} retryHref="/admin/stock" />;
  const { summary, rawMaterials, manufactured, purchased, mixed, opening, recentMovements } = loaded.overview;

  return (
    <section className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-gold-deep">One stock control</p>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink sm:text-3xl">Raw materials and ready goods</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
            Factory materials, KRISHOE-made pairs and supplier-purchased resale pairs are shown separately. Wholesale, retail and online remain sales channels—not extra stock.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/purchasing" className="rounded-full border border-brand-green bg-white px-4 py-2 text-sm font-black text-brand-green">Receive purchase</Link>
          <Link href="/admin/operations" className="rounded-full bg-brand-green px-4 py-2 text-sm font-black text-white">Factory operations</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ready stock" value={summary.readyPairs} detail="Physical pairs available across factory and sales channels." tone="good" />
        <StatCard label="KRISHOE manufactured" value={summary.manufacturedPairs} detail="Current pairs whose source history is Production In." />
        <StatCard label="Purchased for resale" value={summary.purchasedPairs} detail="Current pairs whose source history is Purchase In." />
        <StatCard label="Raw materials" value={summary.rawMaterialItems} detail={`${summary.rawMaterialReorderItems} material item(s) at or below reorder level.`} tone={summary.rawMaterialReorderItems > 0 ? "warn" : "good"} />
      </div>

      <div className="mt-4 rounded-2xl border border-brand-gold/40 bg-brand-cream-soft p-4 text-sm leading-6 text-brand-green-ink">
        <strong>Do not add catalog stock twice:</strong> the shop catalog currently shows {summary.sellableCatalogPairs} sellable pairs across {summary.catalogDesigns} designs. It is the selling view of ready stock, not a fourth warehouse.
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-brand-green-ink">Raw material store</h2>
              <p className="mt-1 text-sm text-gray-600">On hand = opening + received − used.</p>
            </div>
            <Link href="/admin/operations" className="text-sm font-black text-brand-green underline">Manage materials</Link>
          </div>
          {rawMaterials.length === 0 ? (
            <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-500">No raw materials recorded.</p>
          ) : (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {rawMaterials.map((material) => (
                <div key={material.id} className={`rounded-xl border p-4 ${material.needsReorder ? "border-rose-200 bg-rose-50" : "border-gray-100 bg-gray-50"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-brand-green-ink">{material.name}</p>
                      <p className="mt-1 text-xs font-semibold text-gray-500">Reorder at {material.reorderLevel} {material.unit}</p>
                    </div>
                    <p className={`text-lg font-black ${material.needsReorder ? "text-rose-700" : "text-brand-green"}`}>{material.onHand} <span className="text-xs">{material.unit}</span></p>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-gray-500">Received {material.received} · Used {material.used}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="text-lg font-black text-brand-green-ink">Recent stock movement</h2>
          <p className="mt-1 text-sm text-gray-600">The audit trail behind every ready-stock change.</p>
          <div className="mt-4 grid max-h-[420px] gap-2 overflow-auto pr-1">
            {recentMovements.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm font-semibold text-gray-500">No stock movement recorded.</p> : recentMovements.map((movement) => (
              <div key={movement.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-brand-green-ink">{movement.design}</p>
                    <p className="mt-1 text-xs text-gray-500">{movement.channel} · Size {movement.sizeRun}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-black ${movementTone(movement.type)}`}>{movement.type}</span>
                    <p className="mt-1 text-sm font-black text-brand-green-ink">{movement.pairs} pairs</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4">
        <ReadyStockSection title="KRISHOE manufactured stock" origin="Manufactured" rows={manufactured} />
        <ReadyStockSection title="Purchased ready goods for resale" origin="Purchased" rows={purchased} />
        {mixed.length > 0 ? <ReadyStockSection title="Mixed-source designs" origin="Mixed" rows={mixed} /> : null}
        {opening.length > 0 ? <ReadyStockSection title="Opening or adjusted stock" origin="Opening / Adjustment" rows={opening} /> : null}
      </div>
    </section>
  );
}
