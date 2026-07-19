"use server";

import { revalidatePath } from "next/cache";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import {
  createAndDeliverOperationalAlertNotifications,
  createOperationalAlertNotifications,
  deliverPendingNotifications,
  retryNotificationEvent,
} from "@/lib/notifications";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function deliverPendingNotificationsAction() {
  await requireAdminPermission("notifications:write");

  const summary = await deliverPendingNotifications(20);
  await recordAdminAuditEvent(
    "notifications_delivery_run",
    `Notification delivery attempted ${summary.attempted}, sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}.`,
    summary.failed > 0 ? "warning" : "success",
  );
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
}

export async function retryNotificationAction(formData: FormData) {
  await requireAdminPermission("notifications:write");

  const id = textValue(formData, "id");

  if (!id) {
    throw new Error("Notification id is required.");
  }

  const result = await retryNotificationEvent(id);
  await recordAdminAuditEvent(
    "notification_retry",
    `Notification ${id} retry finished with ${result.status}.`,
    result.ok ? "success" : "warning",
  );
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
}

export async function createOperationalAlertNotificationsAction() {
  await requireAdminPermission("notifications:write");

  const summary = await createOperationalAlertNotifications(20);
  await recordAdminAuditEvent(
    "operational_alert_notifications_create",
    `Created ${summary.created} operational alert notification(s) from ${summary.totalAlerts} active alert(s).`,
    summary.created > 0 ? "success" : "warning",
  );
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
}

export async function createAndDeliverOperationalAlertNotificationsAction() {
  await requireAdminPermission("notifications:write");

  const summary = await createAndDeliverOperationalAlertNotifications(20);
  await recordAdminAuditEvent(
    "operational_alert_notifications_deliver",
    `Created ${summary.created} operational alert notification(s), delivery attempted ${summary.delivery.attempted}, sent ${summary.delivery.sent}, failed ${summary.delivery.failed}, skipped ${summary.delivery.skipped}.`,
    summary.delivery.failed > 0 ? "warning" : "success",
  );
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");
  revalidatePath("/admin/activity");
}
