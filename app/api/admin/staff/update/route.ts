import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import { canAccessAdminPath } from "@/lib/admin-role-permissions";
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
      return NextResponse.json({ error: "Only owners can update staff" }, { status: 403 });
    }

    const body = await req.json();
    const { staffId, name, email, role, branch } = body;

    if (!staffId) {
      return NextResponse.json({ error: "Staff ID required" }, { status: 400 });
    }

    // Update staff record
    const result = await sql`
      UPDATE admin_staff
      SET
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        role = COALESCE(${role}, role),
        branch = COALESCE(${branch}, branch),
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
      message: "Staff updated successfully",
    });
  } catch (error) {
    console.error("Error updating staff:", error);
    return NextResponse.json({ error: "Failed to update staff" }, { status: 500 });
  }
}
