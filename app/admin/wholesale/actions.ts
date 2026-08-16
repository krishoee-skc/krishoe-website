"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  updateWholesaleEnquiryStatus,
  type WholesaleEnquiryStatus,
} from "@/lib/wholesale-enquiries";

const statuses: WholesaleEnquiryStatus[] = ["New", "Contacted", "Customer", "Closed"];

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function updateEnquiryStatusAction(formData: FormData) {
  await requireAdminPermission("orders:write");

  const id = textValue(formData, "id");
  const raw = textValue(formData, "status") as WholesaleEnquiryStatus;
  const status = statuses.includes(raw) ? raw : "New";

  if (!id) redirect("/admin/wholesale");

  const updated = await updateWholesaleEnquiryStatus(id, status, textValue(formData, "note"));

  if (updated) {
    await recordAdminAuditEvent(
      "wholesale_enquiry_updated",
      `Wholesale enquiry from ${updated.shopName} marked ${updated.status}.`,
    );
  }

  revalidatePath("/admin/wholesale");
  redirect(`/admin/wholesale?saved=${encodeURIComponent("सुरक्षित भयो ✅")}`);
}
