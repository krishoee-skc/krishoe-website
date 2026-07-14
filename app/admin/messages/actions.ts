"use server";

import { revalidatePath } from "next/cache";
import { appendAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { updateContactStatus, type ContactSubmission } from "@/lib/submissions";

const messageStatuses: ContactSubmission["status"][] = ["New", "Replied"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function statusValue(value: string): ContactSubmission["status"] {
  return messageStatuses.includes(value as ContactSubmission["status"])
    ? (value as ContactSubmission["status"])
    : "New";
}

export async function updateMessageStatusAction(formData: FormData) {
  await requireAdminPermission("messages:write");

  const id = textValue(formData, "id");
  const status = statusValue(textValue(formData, "status"));

  if (!id) {
    throw new Error("Message id is required.");
  }

  await updateContactStatus(id, status);
  await appendAdminAuditEvent(
    "message_status_update",
    `Contact message ${id} marked ${status}.`,
  ).catch(() => undefined);
  revalidatePath("/admin/messages");
  revalidatePath("/admin/activity");
}
