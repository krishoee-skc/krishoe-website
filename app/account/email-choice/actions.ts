"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { setCustomerEmailChoice } from "@/lib/customer-email-choice";
import { reportError } from "@/lib/report-error";
import type { Said } from "@/lib/words";

export type EmailChoiceState = { ok: boolean; message: Said };

/**
 * Saves which letters this customer wants.
 *
 * The signed-in session decides whose preference is being written — never a
 * user id from the form. A posted id would let anybody silence anybody, which
 * is a small harm with a large surprise: the victim would simply stop hearing
 * from the shop and never know why.
 */
export async function saveEmailChoiceAction(
  _previous: EmailChoiceState,
  formData: FormData,
): Promise<EmailChoiceState> {
  const user = await getCurrentCustomer();

  if (!user) {
    return {
      ok: false,
      message: {
        en: "Please sign in again to change this.",
        ne: "यो बदल्न फेरि साइन इन गर्नुहोस्।",
      },
    };
  }

  try {
    await setCustomerEmailChoice(user.id, {
      // An unticked checkbox sends nothing at all, so absence is "no".
      orderUpdates: formData.get("orderUpdates") !== null,
      reviewInvites: formData.get("reviewInvites") !== null,
    });
  } catch (error) {
    reportError("save a customer's email choice", error);
    return {
      ok: false,
      message: {
        en: "That could not be saved. Please try again in a moment.",
        ne: "सुरक्षित गर्न सकिएन। एकैछिनपछि फेरि प्रयास गर्नुहोस्।",
      },
    };
  }

  revalidatePath("/account/email-choice");
  return {
    ok: true,
    message: { en: "Saved.", ne: "सुरक्षित भयो।" },
  };
}
