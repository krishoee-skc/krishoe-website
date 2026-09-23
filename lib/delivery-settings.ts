import { promises as fs } from "fs";
import path from "path";
import { unstable_cache } from "next/cache";
import { writeFileAtomic } from "@/lib/atomic-json";
import { runWithDataBackend } from "@/lib/data-backend";
import {
  cleanDeliveryPricing,
  defaultDeliveryPricing,
  type DeliveryPricing,
} from "@/lib/delivery-fee";
import { queryPostgres } from "@/lib/postgres/client";
import { reportError } from "@/lib/report-error";

const STORE = "admin settings";
const deliverySettingsFile = path.join(process.cwd(), "data", "delivery-settings.json");

/** The tag the storefront caches the delivery promise under. */
export const deliveryPricingTag = "delivery-pricing";

/** Rs 10,000 and Rs 10,00,000 — far past any real courier fee or basket. */
const MAX_FEE_PAISA = 1_000_000;
const MAX_FREE_OVER_PAISA = 100_000_000;

type DeliveryRow = {
  delivery_fee_paisa: number | string | null;
  free_delivery_over_paisa: number | string | null;
};

/**
 * A database that has not run 20260923_delivery_charge.sql yet has no such
 * columns. Migrations are run by hand, so a deploy can land before one does,
 * and that must not take checkout down with it: until the columns exist the
 * shop simply keeps its old promise.
 */
function isMissingColumn(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42703" || code === "42P01";
}

async function readFromPostgres(): Promise<DeliveryPricing> {
  try {
    const rows = await queryPostgres<DeliveryRow>(
      STORE,
      `SELECT delivery_fee_paisa, free_delivery_over_paisa
         FROM company_settings
        WHERE id = 'default'`,
    );
    const row = rows[0];
    if (!row) return defaultDeliveryPricing;
    return cleanDeliveryPricing({
      feePaisa: Number(row.delivery_fee_paisa),
      freeOverPaisa: Number(row.free_delivery_over_paisa),
    });
  } catch (error) {
    if (isMissingColumn(error)) return defaultDeliveryPricing;
    throw error;
  }
}

async function readFromLocalJson(): Promise<DeliveryPricing> {
  try {
    const content = await fs.readFile(deliverySettingsFile, "utf8");
    return cleanDeliveryPricing(JSON.parse(content) as Partial<DeliveryPricing>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return defaultDeliveryPricing;
    throw error;
  }
}

/**
 * The delivery pricing as it stands right now — uncached, because checkout
 * charges by it.
 */
export async function getDeliveryPricing(): Promise<DeliveryPricing> {
  return runWithDataBackend({
    storeName: STORE,
    localJson: readFromLocalJson,
    postgres: readFromPostgres,
  });
}

/**
 * The same, cached for the storefront's banners and badges. A settings hiccup
 * falls back to the old promise rather than taking a page down.
 */
export const getStorefrontDeliveryPricing = unstable_cache(
  async (): Promise<DeliveryPricing> => {
    try {
      return await getDeliveryPricing();
    } catch (error) {
      reportError("load delivery pricing for the storefront", error);
      return defaultDeliveryPricing;
    }
  },
  ["storefront-delivery-pricing"],
  { revalidate: 600, tags: [deliveryPricingTag] },
);

export function validateDeliveryPricing(input: DeliveryPricing): DeliveryPricing {
  const pricing = cleanDeliveryPricing(input);
  if (pricing.feePaisa > MAX_FEE_PAISA) {
    throw new Error("The delivery charge looks too large. Enter it in rupees, e.g. 150.");
  }
  if (pricing.freeOverPaisa > MAX_FREE_OVER_PAISA) {
    throw new Error("The free-delivery amount looks too large. Enter it in rupees, e.g. 2000.");
  }
  return pricing;
}

async function saveToPostgres(pricing: DeliveryPricing) {
  let rows: { id: string }[];
  try {
    rows = await queryPostgres<{ id: string }>(
      STORE,
      `UPDATE company_settings
          SET delivery_fee_paisa = $1,
              free_delivery_over_paisa = $2,
              updated_at = now()
        WHERE id = 'default'
      RETURNING id`,
      [pricing.feePaisa, pricing.freeOverPaisa],
    );
  } catch (error) {
    if (isMissingColumn(error)) {
      throw new Error(
        "The database is not ready for delivery charges yet. Run the migration 20260923_delivery_charge.sql (npm run db:migrate:factory), then save again.",
      );
    }
    throw error;
  }
  if (rows.length === 0) {
    throw new Error("Save the company profile once first, then set the delivery charge.");
  }
}

export async function saveDeliveryPricing(input: DeliveryPricing): Promise<DeliveryPricing> {
  const pricing = validateDeliveryPricing(input);
  await runWithDataBackend({
    storeName: STORE,
    localJson: () => writeFileAtomic(deliverySettingsFile, `${JSON.stringify(pricing, null, 2)}\n`),
    postgres: () => saveToPostgres(pricing),
  });
  return pricing;
}
