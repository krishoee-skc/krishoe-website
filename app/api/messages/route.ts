import { requireAdminPermission } from "@/lib/admin-permissions";
import { getContactMessages } from "@/lib/submissions";

export async function GET() {
  await requireAdminPermission("messages:write");

  const messages = await getContactMessages();

  return Response.json({
    source: "KRISHOE local contact inbox",
    count: messages.length,
    messages,
  });
}
