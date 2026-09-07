import { authorizeFactoryApi } from "@/lib/factory-api-access";
import { getFactoryOwed } from "@/lib/factory-board-data";
import { NextResponse } from "next/server";

/**
 * A read-only glance for the Factory Today screen: how much wage is still owed
 * to workers, and how many workers are carrying a balance.
 *
 * The figure itself is worked out in lib/factory-board-data, which the
 * server-rendered board reads directly. One query, one definition of "owed" —
 * the board and this endpoint cannot drift into two different answers.
 */
export async function GET() {
  const denied = await authorizeFactoryApi("/api/factory/summary", "GET");
  if (denied) return denied;

  try {
    return NextResponse.json(await getFactoryOwed());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load factory summary" },
      { status: 500 },
    );
  }
}
