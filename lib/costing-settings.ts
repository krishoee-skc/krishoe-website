import { readFile } from "node:fs/promises";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "node:path";
import { runWithDataBackend } from "@/lib/data-backend";
import { queryPostgres } from "@/lib/postgres/client";

export const productionStations = [
  "Cutting",
  "Stitching",
  "Sole Press",
  "Finishing",
  "Packing",
  "QC",
] as const;

export type ProductionStation = (typeof productionStations)[number];

export type LaborRates = Record<ProductionStation, number>;

export type CostingSettings = {
  id: "default";
  updatedAt: string;
  laborRates: LaborRates;
  factoryOverheadPerPair: number;
  electricityPerPair: number;
  rentPerPair: number;
  miscellaneousPerPair: number;
  monthlyFixedOverhead: number;
  monthlyCapacityPairs: number;
  note: string;
};

export type CostingSettingsInput = Partial<
  Omit<CostingSettings, "id" | "updatedAt" | "laborRates">
> & {
  laborRates?: Partial<Record<ProductionStation, number>>;
};

type CostingSettingsRow = {
  id: string;
  updated_at: Date | string;
  labor_rates: Record<string, unknown> | string | null;
  factory_overhead_per_pair: number | string;
  electricity_per_pair: number | string;
  rent_per_pair: number | string;
  miscellaneous_per_pair: number | string;
  monthly_fixed_overhead: number | string;
  monthly_capacity_pairs: number | string;
  note: string;
};

const dataDirectory = path.join(process.cwd(), "data");
const costingSettingsPath = path.join(dataDirectory, "costing-settings.json");

const emptyLaborRates = Object.fromEntries(
  productionStations.map((station) => [station, 0]),
) as LaborRates;

export const defaultCostingSettings: CostingSettings = {
  id: "default",
  updatedAt: new Date(0).toISOString(),
  laborRates: emptyLaborRates,
  factoryOverheadPerPair: 0,
  electricityPerPair: 0,
  rentPerPair: 0,
  miscellaneousPerPair: 0,
  monthlyFixedOverhead: 0,
  monthlyCapacityPairs: 1,
  note: "",
};

export function laborRateFieldName(station: ProductionStation) {
  return `laborRate.${station.replace(/\s+/g, "_")}`;
}

function cleanNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function cleanWholeNumber(value: unknown, fallback: number) {
  const numeric = Math.round(Number(value) || fallback);
  return Math.max(1, numeric);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isoDate(value: Date | string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function parseLaborRates(value: unknown) {
  let source: unknown = {};

  if (typeof value === "string") {
    try {
      source = JSON.parse(value || "{}");
    } catch {
      source = {};
    }
  } else if (value && typeof value === "object") {
    source = value;
  }

  return Object.fromEntries(
    productionStations.map((station) => [
      station,
      cleanNumber((source as Partial<Record<ProductionStation, unknown>>)[station]),
    ]),
  ) as LaborRates;
}

export function normalizeCostingSettings(value: Partial<CostingSettings> | null | undefined): CostingSettings {
  return {
    id: "default",
    updatedAt: isoDate(value?.updatedAt ?? defaultCostingSettings.updatedAt),
    laborRates: {
      ...emptyLaborRates,
      ...parseLaborRates(value?.laborRates ?? {}),
    },
    factoryOverheadPerPair: cleanNumber(value?.factoryOverheadPerPair),
    electricityPerPair: cleanNumber(value?.electricityPerPair),
    rentPerPair: cleanNumber(value?.rentPerPair),
    miscellaneousPerPair: cleanNumber(value?.miscellaneousPerPair),
    monthlyFixedOverhead: cleanNumber(value?.monthlyFixedOverhead),
    monthlyCapacityPairs: cleanWholeNumber(value?.monthlyCapacityPairs, 1),
    note: cleanText(value?.note),
  };
}

async function getCostingSettingsFromLocalJson() {
  try {
    const raw = await readFile(costingSettingsPath, "utf8");
    return normalizeCostingSettings(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultCostingSettings;
    }

    throw error;
  }
}

async function writeCostingSettings(settings: CostingSettings) {
  await writeFileAtomic(costingSettingsPath, `${JSON.stringify(settings, null, 2)}\n`);
}

function costingSettingsFromRow(row: CostingSettingsRow): CostingSettings {
  return normalizeCostingSettings({
    updatedAt: isoDate(row.updated_at),
    laborRates: parseLaborRates(row.labor_rates),
    factoryOverheadPerPair: cleanNumber(row.factory_overhead_per_pair),
    electricityPerPair: cleanNumber(row.electricity_per_pair),
    rentPerPair: cleanNumber(row.rent_per_pair),
    miscellaneousPerPair: cleanNumber(row.miscellaneous_per_pair),
    monthlyFixedOverhead: cleanNumber(row.monthly_fixed_overhead),
    monthlyCapacityPairs: cleanWholeNumber(row.monthly_capacity_pairs, 1),
    note: row.note,
  });
}

async function getCostingSettingsFromPostgres() {
  const rows = await queryPostgres<CostingSettingsRow>(
    "costing settings",
    `
      SELECT id, updated_at, labor_rates, factory_overhead_per_pair,
        electricity_per_pair, rent_per_pair, miscellaneous_per_pair,
        monthly_fixed_overhead, monthly_capacity_pairs, note
      FROM costing_settings
      WHERE id = 'default'
      LIMIT 1
    `,
  );

  return rows[0] ? costingSettingsFromRow(rows[0]) : defaultCostingSettings;
}

async function upsertCostingSettingsToPostgres(settings: CostingSettings) {
  const rows = await queryPostgres<CostingSettingsRow>(
    "costing settings",
    `
      INSERT INTO costing_settings (
        id, updated_at, labor_rates, factory_overhead_per_pair,
        electricity_per_pair, rent_per_pair, miscellaneous_per_pair,
        monthly_fixed_overhead, monthly_capacity_pairs, note
      )
      VALUES ('default', $1, $2::jsonb, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        updated_at = EXCLUDED.updated_at,
        labor_rates = EXCLUDED.labor_rates,
        factory_overhead_per_pair = EXCLUDED.factory_overhead_per_pair,
        electricity_per_pair = EXCLUDED.electricity_per_pair,
        rent_per_pair = EXCLUDED.rent_per_pair,
        miscellaneous_per_pair = EXCLUDED.miscellaneous_per_pair,
        monthly_fixed_overhead = EXCLUDED.monthly_fixed_overhead,
        monthly_capacity_pairs = EXCLUDED.monthly_capacity_pairs,
        note = EXCLUDED.note
      RETURNING id, updated_at, labor_rates, factory_overhead_per_pair,
        electricity_per_pair, rent_per_pair, miscellaneous_per_pair,
        monthly_fixed_overhead, monthly_capacity_pairs, note
    `,
    [
      settings.updatedAt,
      JSON.stringify(settings.laborRates),
      settings.factoryOverheadPerPair,
      settings.electricityPerPair,
      settings.rentPerPair,
      settings.miscellaneousPerPair,
      settings.monthlyFixedOverhead,
      settings.monthlyCapacityPairs,
      settings.note,
    ],
  );

  return costingSettingsFromRow(rows[0]);
}

export async function getCostingSettings() {
  return runWithDataBackend({
    storeName: "costing settings",
    localJson: getCostingSettingsFromLocalJson,
    postgres: getCostingSettingsFromPostgres,
  });
}

export async function updateCostingSettings(input: CostingSettingsInput) {
  const current = await getCostingSettings();
  const next = normalizeCostingSettings({
    ...current,
    ...input,
    laborRates: {
      ...current.laborRates,
      ...(input.laborRates ?? {}),
    },
    updatedAt: new Date().toISOString(),
  });

  return runWithDataBackend({
    storeName: "costing settings",
    localJson: async () => {
      await writeCostingSettings(next);
      return next;
    },
    postgres: () => upsertCostingSettingsToPostgres(next),
  });
}
