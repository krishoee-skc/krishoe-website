import { emailLinkBaseUrl } from "@/lib/email-links";
import {
  listAttemptsToRemind,
  markAttemptReminded,
} from "@/lib/checkout-attempts";
import { sendStaffSecurityEmail } from "@/lib/notifications";
import { reportError } from "@/lib/report-error";

export const dynamic = "force-dynamic";

function rupees(paisa: number) {
  return `Rs. ${Math.round(paisa / 100).toLocaleString("en-IN")}`;
}

/**
 * One reminder to each shopper who reached checkout, gave an address, and
 * stopped.
 *
 * Everything except the last tap already happened — the pairs are chosen, the
 * address is typed — so this is the cheapest order the shop will ever take.
 * One message and only one: a row is marked the moment it is sent, and a
 * shopper who returns to the page resets rather than duplicates.
 *
 * Guarded by CRON_SECRET like the sales digests, so nobody else can make the
 * shop write to its own customers.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return new Response("Cron is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${secret}`) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const attempts = await listAttemptsToRemind();
  let sent = 0;
  let failed = 0;

  for (const attempt of attempts) {
    const greeting = attempt.name ? `${attempt.name},` : "नमस्ते,";
    const delivery = await sendStaffSecurityEmail({
      email: attempt.email,
      subject: "तपाईंको जुत्ता अझै कार्टमा छ — KRISHOE",
      payload: {
        email: attempt.email,
        kind: "security-alert",
        message: [
          greeting,
          "",
          `तपाईंले छान्नुभएको ${attempt.summary || "सामान"} अझै कार्टमा छ।`,
          `जम्मा ${rupees(attempt.totalPaisa)} · ${attempt.itemCount} जोडी`,
          "",
          "स्टक सीमित छ — चाहनुहुन्छ भने तलको लिंकबाट अर्डर पूरा गर्नुहोस्।",
          "",
          "साइज वा रङमा अन्योल भए WhatsApp मा सोध्नुहोस्, हामी भनिदिन्छौँ।",
        ].join("\n"),
        actionUrl: `${emailLinkBaseUrl()}/cart`,
      },
    });

    if (delivery.ok) {
      sent += 1;
      // Marked only on a successful send: a row marked after a failed delivery
      // is a shopper who is never written to at all.
      await markAttemptReminded(attempt.id);
    } else {
      failed += 1;
      reportError(
        `send checkout reminder to ${attempt.email}`,
        new Error(delivery.error ?? "unknown delivery failure"),
      );
    }
  }

  return Response.json(
    { ok: true, candidates: attempts.length, sent, failed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
