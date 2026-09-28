"use client";

import { useState } from "react";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import { money } from "@/lib/format-money";
import { approveSimpleCostAction } from "../actions";

export type CostRow = {
  itemId: string;
  name: string;
  /** The wages of the stages this shoe has a rate for, added up. */
  wage: number;
  stages: { stage: string; rate: number }[];
  /** Prefilled from the factory item's material cost, else the last card. */
  material: number;
  profitPercent: number;
  retailExtra: number;
  /** The making cost last approved, to compare against. */
  approvedCost: number | null;
};

const STAGE_COUNT = 4;

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

/**
 * One line per shoe: the material in a pair, the wages already on file, and
 * the selling rates worked out as the numbers are typed.
 *
 * It replaced three separate forms — raw material, a recipe per material, a
 * price card — none of which had ever been filled, because the recipe route
 * needs every material bought and priced first. The owner knows what the
 * material in a pair costs; that one number is enough to price the shoe.
 */
export default function CostTable({ rows }: { rows: CostRow[] }) {
  const { text } = useLanguage();

  if (rows.length === 0) {
    return (
      <p className="text-sm text-brand-muted">
        {text("Add a shoe below first.", "पहिले तल जुत्ता दर्ता गर्नुहोस्।")}
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <CostLine key={row.itemId} row={row} />
      ))}
    </div>
  );
}

function CostLine({ row }: { row: CostRow }) {
  const { text } = useLanguage();
  const [material, setMaterial] = useState(row.material > 0 ? String(row.material) : "");
  const [profit, setProfit] = useState(String(row.profitPercent));
  const [extra, setExtra] = useState(String(row.retailExtra));

  const materialValue = Number(material) || 0;
  const cost = round2(materialValue + row.wage);
  const wholesale = round2(cost * (1 + (Number(profit) || 0) / 100));
  const retail = round2(wholesale + (Number(extra) || 0));
  const ready = materialValue > 0 && row.stages.length > 0;
  const field =
    "h-11 w-full min-w-0 rounded-lg border border-brand-green-line bg-brand-paper px-2 text-right tabular-nums text-brand-green-ink";

  return (
    <EnterWalkForm
      action={approveSimpleCostAction}
      className="grid items-start gap-3 rounded-xl border border-brand-green-line bg-brand-paper-deep p-3 sm:grid-cols-2 lg:grid-cols-[minmax(9rem,1.2fr)_repeat(6,minmax(0,1fr))_auto]"
    >
      <input type="hidden" name="itemId" value={row.itemId} />
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <p className="truncate font-black text-brand-green-ink">{row.name}</p>
        {row.approvedCost !== null ? (
          <p className="text-xs text-brand-muted">
            {text(`Approved: ${money(row.approvedCost)}`, `पक्का गरिएको: ${money(row.approvedCost)}`)}
          </p>
        ) : (
          <p className="text-xs font-bold text-amber-800">{text("No cost yet", "लागत निकालिएको छैन")}</p>
        )}
      </div>

      <label className="block min-w-0 text-xs font-bold text-brand-muted">
        {text("Material / pair", "माल / जोडी")}
        <input
          name="materialCostPerPair"
          data-summary="money"
          type="number"
          min="0.01"
          step="0.01"
          inputMode="decimal"
          required
          value={material}
          placeholder="?"
          onChange={(event) => setMaterial(event.target.value)}
          className={`${field} mt-1`}
        />
      </label>

      <div className="min-w-0 text-xs font-bold text-brand-muted">
        {text("Wages", "ज्याला")}
        <p className="mt-1 flex h-11 items-center justify-end rounded-lg bg-brand-mist px-2 font-black tabular-nums text-brand-green-ink">
          {money(row.wage)}
        </p>
        <p
          className={`mt-0.5 text-[11px] ${row.stages.length < STAGE_COUNT ? "font-bold text-amber-800" : "text-brand-muted"}`}
          title={row.stages.map((stage) => `${stage.stage} ${money(stage.rate)}`).join(" · ")}
        >
          {row.stages.length === 0
            ? text("No wage rate yet", "ज्याला दर छैन")
            : text(`${row.stages.length} of ${STAGE_COUNT} works`, `${STAGE_COUNT} मध्ये ${row.stages.length} काम`)}
        </p>
      </div>

      <div className="min-w-0 text-xs font-bold text-brand-muted">
        {text("Cost", "लागत")}
        <p className="mt-1 flex h-11 items-center justify-end rounded-lg bg-brand-mist px-2 font-black tabular-nums text-brand-green-ink">
          {materialValue > 0 ? money(cost) : "—"}
        </p>
      </div>

      <label className="block min-w-0 text-xs font-bold text-brand-muted">
        {text("Wholesale profit %", "होलसेल नाफा %")}
        <input
          name="wholesaleProfitPercent"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          required
          value={profit}
          onChange={(event) => setProfit(event.target.value)}
          className={`${field} mt-1`}
        />
      </label>

      <label className="block min-w-0 text-xs font-bold text-brand-muted">
        {text("Retail extra Rs.", "खुद्रामा थप रु.")}
        <input
          name="retailExtraAmount"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          required
          value={extra}
          onChange={(event) => setExtra(event.target.value)}
          className={`${field} mt-1`}
        />
      </label>

      <div className="min-w-0 text-xs font-bold text-brand-muted">
        {text("Wholesale · Retail", "होलसेल · खुद्रा")}
        <p className="mt-1 flex h-11 flex-col items-end justify-center rounded-lg bg-brand-green-wash px-2 font-black leading-tight tabular-nums text-brand-green-ink">
          <span>{materialValue > 0 ? money(wholesale) : "—"}</span>
          <span className="text-xs text-brand-muted">{materialValue > 0 ? money(retail) : ""}</span>
        </p>
      </div>

      <FormSubmitButton
        disabled={!ready}
        className="h-11 rounded-lg lg:mt-5 bg-brand-green px-4 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-50"
        pendingLabel="…"
      >
        {text("✓ Approve", "✓ पक्का गर्ने")}
      </FormSubmitButton>
    </EnterWalkForm>
  );
}
