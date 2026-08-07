import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import { sql } from "@vercel/postgres";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminRole = getSessionAdminRole(session);
    if (adminRole !== "Owner") {
      return NextResponse.json({ error: "Only owners can update staff status" }, { status: 403 });
    }

    const body = await req.json();
    const { staffId, status } = body;

    if (!staffId || !status) {
      return NextResponse.json({ error: "Staff ID and status required" }, { status: 400 });
    }

    if (!["active", "inactive"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Update staff status
    const result = await sql`
      UPDATE admin_staff
      SET
        status = ${status},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${staffId}
      RETURNING *;
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      staff: result.rows[0],
      message: `Staff status changed to ${status}`,
    });
  } catch (error) {
    console.error("Error updating staff status:", error);
    return NextResponse.json({ error: "Failed to update staff status" }, { status: 500 });
  }
}
