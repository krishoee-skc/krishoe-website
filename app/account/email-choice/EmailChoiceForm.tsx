"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import { saveEmailChoiceAction, type EmailChoiceState } from "./actions";

const START: EmailChoiceState = { ok: false, message: { en: "", ne: "" } };

/**
 * The two tick boxes, and one of them is nearly always ticked.
 *
 * Order confirmations can be turned off, but the box says plainly what turning
 * it off costs: no record of what was paid for. Most people who reach this page
 * want the review invitations to stop and nothing else, so that is the box
 * sitting where the thumb lands.
 */
export default function EmailChoiceForm({
  orderUpdates,
  reviewInvites,
}: {
  orderUpdates: boolean;
  reviewInvites: boolean;
}) {
  const [state, action] = useActionState(saveEmailChoiceAction, START);
  const { text } = useLanguage();

  return (
    <form action={action} className="mt-6 grid gap-5 rounded-2xl border border-brand-green-line bg-brand-paper p-6">
      <label className="flex items-start gap-3 text-sm font-bold text-brand-green-ink">
        <input
          type="checkbox"
          name="reviewInvites"
          defaultChecked={reviewInvites}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green"
        />
        <span>
          {text("Ask me how a pair worked out", "जुत्ता कस्तो लाग्यो भनेर सोध्ने")}
          <span className="mt-1 block text-xs font-medium leading-5 text-brand-muted">
            {text(
              "One letter, a few weeks after an order. Turning this off changes nothing else.",
              "अर्डरको केही हप्तापछि एउटा चिठी। यो बन्द गर्दा अरू केही फरक पर्दैन।",
            )}
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 text-sm font-bold text-brand-green-ink">
        <input
          type="checkbox"
          name="orderUpdates"
          defaultChecked={orderUpdates}
          className="mt-0.5 h-5 w-5 shrink-0 accent-brand-green"
        />
        <span>
          {text("Confirm my orders by email", "अर्डर पक्का भएको email पठाउने")}
          <span className="mt-1 block text-xs font-medium leading-5 text-brand-muted">
            {text(
              "Recommended. This letter is your record of what you ordered and what it cost.",
              "राख्नु राम्रो। यो चिठी नै तपाईंले के मगाउनुभयो र कति पर्‍यो भन्ने प्रमाण हो।",
            )}
          </span>
        </span>
      </label>

      <div className="grid gap-3">
        <SubmitButton
          idleLabel={text("Save", "सुरक्षित गर्ने")}
          pendingLabel={text("Saving…", "गर्दैछौँ…")}
        />
        {state.message.en ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-4 text-sm font-semibold ${
              state.ok
                ? "bg-brand-green-mist text-brand-green"
                : "bg-brand-clay-mist text-brand-clay"
            }`}
          >
            {text(state.message.en, state.message.ne)}
          </p>
        ) : null}
      </div>
    </form>
  );
}
