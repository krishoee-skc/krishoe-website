"use server";

import { headers } from "next/headers";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { getAdminSettings } from "@/lib/admin-settings";
import { reportingErrors } from "@/lib/report-error";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";
import { saveWholesaleEnquiry } from "@/lib/wholesale-enquiries";

export type WholesaleFormState = { ok: boolean; message: string; reference?: string };

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A shop asking to buy in bulk.
 *
 * Deliberately not an order: a wholesale deal in Nepal is settled on the phone
 * — rate, sizes, credit terms, when the truck comes. What this has to do is
 * make sure the owner learns a shop asked, with enough to call them back.
 */
export async function submitWholesaleEnquiry(
  _previousState: WholesaleFormState,
  formData: FormData,
): Promise<WholesaleFormState> {
  const shopName = textValue(formData, "shopName");
  const contactName = textValue(formData, "contactName");
  const phone = textValue(formData, "phone");

  if (!shopName || !contactName || !phone) {
    return { ok: false, message: "पसलको नाम, तपाईंको नाम र फोन नम्बर चाहिन्छ।" };
  }

  const headerStore = await headers();
  const limit = await checkAndRecordSubmissionLimit({
    bucket: "wholesale-enquiry",
    key:
      headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
      || headerStore.get("x-real-ip")?.trim()
      || phone,
    maxAttempts: 5,
    windowMs: 30 * 60_000,
  });

  if (limit.limited) {
    return {
      ok: false,
      message: `धेरै पटक पठाइयो। ${Math.ceil(limit.retryAfterSeconds / 60)} मिनेटपछि फेरि प्रयास गर्नुहोस्।`,
    };
  }

  const enquiry = await saveWholesaleEnquiry({
    shopName,
    contactName,
    phone,
    email: textValue(formData, "email"),
    location: textValue(formData, "location"),
    requirement: textValue(formData, "requirement"),
    monthlyPairs: Number(textValue(formData, "monthlyPairs")) || 0,
  });

  // Saved is saved. An enquiry that reached the database must not be reported
  // as failed because an email did not go out — the owner can still see it in
  // the admin, and telling the shop to send it again would create a duplicate.
  await reportingErrors(`notify owner of wholesale enquiry ${enquiry.id}`, async () => {
    const settings = await getAdminSettings();
    const owner = settings.staff.find(
      (member) => member.role === "Owner" && member.status === "Active" && member.email,
    );
    const to = owner?.email || settings.company.email;
    if (!to) return;

    await sendStaffSecurityEmail({
      email: to,
      subject: `थोकको सोधपुछ — ${enquiry.shopName}`,
      payload: {
        email: to,
        kind: "security-alert",
        message: [
          "नयाँ थोक सोधपुछ आयो।",
          "",
          `पसल      : ${enquiry.shopName}`,
          `सम्पर्क    : ${enquiry.contactName}`,
          `फोन       : ${enquiry.phone}`,
          enquiry.email ? `इमेल      : ${enquiry.email}` : "",
          enquiry.location ? `ठाउँ      : ${enquiry.location}` : "",
          enquiry.monthlyPairs ? `महिनामा   : ${enquiry.monthlyPairs} जोडी` : "",
          "",
          enquiry.requirement ? `के चाहिन्छ: ${enquiry.requirement}` : "",
          "",
          "चाँडो फोन गर्नुहोस् — थोकको ग्राहक पर्खँदैनन्।",
        ]
          .filter(Boolean)
          .join("\n"),
      },
    });
  });

  return {
    ok: true,
    message: "पठाइयो ✅ हामी चाँडै फोन गर्छौँ।",
    reference: enquiry.id,
  };
}
