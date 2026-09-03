import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { readAdminFacts } from "@/lib/admin-facts";

/**
 * The shop's own true numbers, for the command box to read.
 *
 * Every figure comes from readAdminFacts (lib/admin-facts.ts), which pulls from
 * the same snapshot the dashboard renders — so this route does no arithmetic of
 * its own and cannot drift from what the owner sees on the home screen. It is
 * the single, trustworthy source the assistant is handed, so the assistant
 * never has to (and never gets to) work a number out for itself.
 *
 * Read-only and login-guarded by construction: requireAdminPermission gates it
 * like every other admin route, and readAdminFacts only reads snapshots — there
 * is no write path here.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const adminUser = await requireAdminPermission("production:entry");
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const facts = await readAdminFacts();
  return NextResponse.json(facts);
}
