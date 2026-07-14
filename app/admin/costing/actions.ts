"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  laborRateFieldName,
  productionStations,
  updateCostingSettings,
  type ProductionStation,
} from "@/lib/costing-settings";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(formData: FormData, key: string) {
  const numeric = Number(textValue(formData, key));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 100) / 100) : 0;
}

function wholeNumberValue(formData: FormData, key: string, fallback: number) {
  const numeric = Math.round(Number(textValue(formData, key)) || fallback);
  return Math.max(1, numeric);
}

function refreshCostingPage() {
  revalidatePath("/admin");
  revalidatePath("/admin/costing");
  redirect("/admin/costing");
}

export async function updateCostingSettingsAction(formData: FormData) {
  await requireAdminPermission("costing:write");

  const laborRates = Object.fromEntries(
    productionStations.map((station) => [
      station,
      numberValue(formData, laborRateFieldName(station)),
    ]),
  ) as Record<ProductionStation, number>;

  await updateCostingSettings({
    laborRates,
    factoryOverheadPerPair: numberValue(formData, "factoryOverheadPerPair"),
    electricityPerPair: numberValue(formData, "electricityPerPair"),
    rentPerPair: numberValue(formData, "rentPerPair"),
    miscellaneousPerPair: numberValue(formData, "miscellaneousPerPair"),
    monthlyFixedOverhead: numberValue(formData, "monthlyFixedOverhead"),
    monthlyCapacityPairs: wholeNumberValue(formData, "monthlyCapacityPairs", 1),
    note: textValue(formData, "note"),
  });

  await appendAdminAuditEvent(
    "costing_settings_update",
    "Factory labor and overhead costing settings updated.",
  ).catch(() => undefined);

  refreshCostingPage();
}
