"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordAdminAuditEvent } from "@/lib/admin-audit";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { couponHasEnded, getCoupon, normalizeCouponCode, saveCoupon, setCouponStatus, type CouponKind } from "@/lib/coupons";
import { LOW_CAP_RUPEES } from "./cap";

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

function backTo(kind: "success" | "error", message: string, edit = "") {
  redirect(`/admin/coupons?${kind}=${encodeURIComponent(message)}${edit ? `&edit=${encodeURIComponent(edit)}#coupon-form` : ""}`);
}

const SAY = {
  lowCap: (rupees: number) => ({
    en: `At most Rs ${rupees} off — is that meant? Press "Yes" on the form.`,
    ne: `बढीमा Rs ${rupees} मात्र छुट — पक्का हो? Form मा "हो" थिच्नुहोस्।`,
  }),
  ended: { en: "Its end date has passed — give a new end date first.", ne: "यसको म्याद सकिइसकेको छ — पहिले नयाँ अन्तिम मिति राख्नुहोस्।" },
  usedUp: { en: "It has been used as many times as it may be — raise the limit first.", ne: "यो जति पटक चल्न मिल्थ्यो, सबै चलिसक्यो — पहिले सीमा बढाउनुहोस्।" },
  off: (code: string) => ({ en: `${code} is off. Checkout no longer takes it.`, ne: `${code} बन्द भयो। अब checkout ले यो लिँदैन।` }),
  on: (code: string) => ({ en: `${code} is on again.`, ne: `${code} फेरि चालू भयो।` }),
  missing: { en: "That code was not found.", ne: "त्यो कोड भेटिएन।" },
};
const both = (words: { en: string; ne: string }) => `${words.ne} · ${words.en}`;

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

    // A ceiling under Rs 50 is asked about on the form (owner, 2026-10-21);
    // this is the backstop for a form that did not ask.
    const capRupees = Number(textValue(formData, "maxDiscountRupees"));
    if (kind === "percent" && capRupees > 0 && capRupees < LOW_CAP_RUPEES && textValue(formData, "lowCapYes") !== "yes") {
      throw new Error(both(SAY.lowCap(capRupees)));
    }
    // On, with an end already gone by, is off in all but name.
    const endsAt = textValue(formData, "expiresAt");
    if (textValue(formData, "status") !== "Disabled" && endsAt && couponHasEnded(endsAt)) {
      throw new Error(both(SAY.ended));
    }

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
    backTo("error", error instanceof Error ? error.message : "कोड सुरक्षित भएन।", textValue(formData, "editing"));
  }

  revalidatePath("/admin/coupons");
  backTo("success", message);
}

/**
 * Off or on from the code's own card (owner, 2026-10-21, the coupon sample,
 * 1): it took the whole form typed again to turn DASHAINOFFER off. A code that
 * has ended cannot simply come back on; the form opens on it to give a new end
 * date or a higher limit.
 */
export async function switchCouponAction(formData: FormData) {
  const code = normalizeCouponCode(textValue(formData, "code"));
  const turnOn = textValue(formData, "to") === "on";
  // Where to go, decided inside; the redirect itself is outside the try, as a
  // redirect is thrown and the catch would take it for a failure.
  let outcome: { kind: "success" | "error"; message: string; edit?: string };
  try {
    const actor = await requireAdminPermission("settings:write");
    const coupon = await getCoupon(code);
    if (!coupon) {
      outcome = { kind: "error", message: both(SAY.missing) };
    } else if (turnOn && couponHasEnded(coupon.expiresAt)) {
      outcome = { kind: "error", message: both(SAY.ended), edit: coupon.code };
    } else if (turnOn && coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      outcome = { kind: "error", message: both(SAY.usedUp), edit: coupon.code };
    } else {
      await setCouponStatus(coupon.code, turnOn ? "Active" : "Disabled");
      await recordAdminAuditEvent(
        "coupon_saved",
        `Coupon ${coupon.code} turned ${turnOn ? "on" : "off"} by ${actor.session.email ?? "Owner"}, used ${coupon.usedCount}.`,
      );
      outcome = { kind: "success", message: both(turnOn ? SAY.on(coupon.code) : SAY.off(coupon.code)) };
    }
  } catch (error) {
    outcome = { kind: "error", message: error instanceof Error ? error.message : both(SAY.missing) };
  }
  revalidatePath("/admin/coupons");
  backTo(outcome.kind, outcome.message, outcome.edit);
}
