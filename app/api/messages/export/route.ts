import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { csvResponse, toCsv } from "@/lib/csv";
import { getContactMessages } from "@/lib/submissions";

export async function GET() {
  await requireAdminPermission("exports:read");

  const messages = await getContactMessages();
  await recordAdminAuditEvent(
    "message_export",
    `${messages.length} contact message rows exported as CSV.`,
  );
  const csv = toCsv(
    ["id", "createdAt", "name", "email", "message", "status"],
    messages.map((message) => [
      message.id,
      message.createdAt,
      message.name,
      message.email,
      message.message,
      message.status,
    ]),
  );

  return csvResponse("krishoe-messages.csv", csv);
}
