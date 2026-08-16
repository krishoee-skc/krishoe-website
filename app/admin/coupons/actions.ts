"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { normalizeCouponCode, saveCoupon, type CouponKind } from "@/lib/coupons";

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function rupeesToPaisa(formData: FormData, key: string) {
  const rupees = Number(textValue(formData, key));
  return Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) : 0;
}

function optionalNumber(formData: FormData, key: string) {
  const raw = Number(textValue(formData, key));
  return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
}

function backTo(kind: "success" | "error", message: string) {
  redirect(`/admin/coupons?${kind}=${encodeURIComponent(message)}`);
}

export async function saveCouponAction(formData: FormData) {
  let message = "";
  try {
    const actor = await requireAdminPermission("settings:write");
    const kind: CouponKind = textValue(formData, "kind") === "amount" ? "amount" : "percent";
    const code = normalizeCouponCode(textValue(formData, "code"));

    // Percentages are typed as a number; a fixed discount is typed in rupees,
    // because nobody running a shop thinks in paisa.
    const value =
      kind === "percent"
        ? Math.round(Number(textValue(formData, "percent")) || 0)
        : rupeesToPaisa(formData, "amountRupees");

    const coupon = await saveCoupon({
      code,
      kind,
      value,
      minOrderPaisa: rupeesToPaisa(formData, "minOrderRupees"),
      maxDiscountPaisa:
        kind === "percent" ? (rupeesToPaisa(formData, "maxDiscountRupees") || null) : null,
      startsAt: textValue(formData, "startsAt") || null,
      expiresAt: textValue(formData, "expiresAt") || null,
      maxUses: optionalNumber(formData, "maxUses"),
      status: textValue(formData, "status") === "Disabled" ? "Disabled" : "Active",
      note: textValue(formData, "note"),
    });

    await recordAdminAuditEvent(
      "coupon_saved",
      `Coupon ${coupon.code} saved by ${actor.session.email ?? "Owner"}: ${
        coupon.kind === "percent" ? `${coupon.value}%` : `Rs ${coupon.value / 100}`
      }, used ${coupon.usedCount}${coupon.maxUses ? ` of ${coupon.maxUses}` : ""}.`,
    );

    message = `${coupon.code} सुरक्षित भयो ✅`;
  } catch (error) {
    backTo("error", error instanceof Error ? error.message : "कोड सुरक्षित भएन।");
  }

  revalidatePath("/admin/coupons");
  backTo("success", message);
}
