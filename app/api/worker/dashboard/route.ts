import { NextResponse } from "next/server";
import { getCurrentWorkerAccess } from "@/lib/worker-auth";

export async function GET() {
  const access = await getCurrentWorkerAccess();

  if (!access.authenticated) {
    return NextResponse.json(
      { error: "Worker sign-in is required" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!access.linked) {
    return NextResponse.json(
      { error: access.reason },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { detail } = access;
  return NextResponse.json(
    {
      data: {
        profile: {
          id: detail.employee.id,
          name: detail.employee.name,
          phone: detail.employee.phone,
          role: detail.employee.role,
          department: detail.employee.department,
          employmentType: detail.employee.employmentType,
          salaryType: detail.employee.salaryType,
          joinedAt: detail.employee.joinedAt,
          status: detail.employee.status,
        },
        summary: detail.summary,
        attendance: detail.attendanceRecords,
        payroll: detail.payrollRecords.filter((record) => record.status !== "Draft"),
        production: detail.workerTasks,
      },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
