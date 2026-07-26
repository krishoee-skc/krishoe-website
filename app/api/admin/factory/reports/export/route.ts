import { requireAdminPermission } from "@/lib/admin-permissions";
import { getFactoryData, getFactoryPerformanceReport } from "@/lib/factory";

export const dynamic = "force-dynamic";

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  await requireAdminPermission("factory:write");
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const factory = await getFactoryData();
  let report;
  try {
    report = getFactoryPerformanceReport(factory, from, to);
  } catch {
    return new Response("A valid from/to date range is required.", { status: 400 });
  }
  const rows: Array<Array<string | number>> = [
    ["KRISHOE Factory verified production report"],
    ["From", report.from, "To", report.to],
    ["Good pairs", report.goodPairs],
    ["Reject pairs", report.rejectPairs],
    ["Rework pairs", report.reworkPairs],
    ["Verified wage", report.verifiedWage],
    [],
    ["Worker ID", "Worker", "Good", "Reject", "Rework", "Quality %", "Verified wage", "Entries"],
    ...report.workers.map((row) => [
      row.key,
      row.label,
      row.goodPairs,
      row.rejectPairs,
      row.reworkPairs,
      row.qualityRate,
      row.verifiedWage,
      row.entryCount,
    ]),
    [],
    ["Stage", "Good", "Reject", "Rework", "Quality %", "Verified wage", "Entries"],
    ...report.stages.map((row) => [
      row.label,
      row.goodPairs,
      row.rejectPairs,
      row.reworkPairs,
      row.qualityRate,
      row.verifiedWage,
      row.entryCount,
    ]),
    [],
    ["Item", "Good", "Reject", "Rework", "Quality %", "Verified wage", "Entries"],
    ...report.items.map((row) => [
      row.label,
      row.goodPairs,
      row.rejectPairs,
      row.reworkPairs,
      row.qualityRate,
      row.verifiedWage,
      row.entryCount,
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="krishoe-factory-${from}-to-${to}.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
