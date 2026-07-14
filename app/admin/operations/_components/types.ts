import type { getOperationsSnapshot } from "@/lib/operations";
import type { getCostingSnapshot } from "@/lib/costing";

export type OperationsSnapshot = Awaited<ReturnType<typeof getOperationsSnapshot>>;
export type OperationsCostingSnapshot = Awaited<ReturnType<typeof getCostingSnapshot>>;
