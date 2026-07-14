import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  getProductionReadinessWithData,
  summarizeProductionReadiness,
} from "@/lib/production-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdminPermission("readiness:read");
  const checks = await getProductionReadinessWithData();

  return Response.json(
    {
      source: "KRISHOE production readiness",
      checkedAt: new Date().toISOString(),
      summary: summarizeProductionReadiness(checks),
      checks,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
