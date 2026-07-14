import { requireAdminPermission } from "@/lib/admin-permissions";
import { getOrders } from "@/lib/submissions";

export async function GET() {
  await requireAdminPermission("orders:write");

  const orders = await getOrders();

  return Response.json({
    source: "KRISHOE local order inbox",
    count: orders.length,
    orders,
  });
}
