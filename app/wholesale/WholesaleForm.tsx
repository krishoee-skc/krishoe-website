"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";
import { submitWholesaleEnquiry, type WholesaleFormState } from "./actions";

const initialState: WholesaleFormState = { ok: false, message: { en: "", ne: "" } };
const inputClass =
  "min-h-14 rounded-lg border border-black/10 px-4 py-2 font-normal outline-none focus:border-brand-green md:h-12 md:py-0";

export default function WholesaleForm() {
  const [state, formAction] = useActionState(submitWholesaleEnquiry, initialState);
  const { text } = useLanguage();

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-brand-green/25 bg-brand-green-mist p-6 text-center">
        <p className="text-2xl font-black text-brand-green-ink">
          {text("Thank you 🙏", "धन्यवाद 🙏")}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-brand-green">
          {text(state.message.en, state.message.ne)}
        </p>
        <p className="mt-3 font-mono text-xs text-brand-muted">{state.reference}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Shop name *", "पसलको नाम *")}
        <input
          name="shopName"
          required
          maxLength={120}
          className={inputClass}
          placeholder={text("e.g. Gurung Footwear", "जस्तै: गुरुङ फुटवेयर")}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Your name *", "तपाईंको नाम *")}
        <input name="contactName" required maxLength={120} autoComplete="name" className={inputClass} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Phone number *", "फोन नम्बर *")}
        <input
          name="phone"
          type="tel"
          required
          maxLength={40}
          autoComplete="tel"
          className={inputClass}
          placeholder="98XXXXXXXX"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Email (if you have one)", "इमेल (भए)")}
        <input name="email" type="email" maxLength={160} autoComplete="email" className={inputClass} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Where the shop is", "पसल कहाँ छ")}
        <input
          name="location"
          maxLength={160}
          className={inputClass}
          placeholder={text("Town, district", "सहर, जिल्ला")}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Roughly how many pairs a month", "महिनामा कति जोडी जति")}
        <input name="monthlyPairs" type="number" min="0" className={inputClass} placeholder="200" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-brand-green-ink md:col-span-2">
        {text("What you need", "के चाहिन्छ")}
        <textarea
          name="requirement"
          rows={4}
          maxLength={1200}
          className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
          placeholder={text(
            "e.g. ladies' slippers and sandals, sizes 36–41, about 200 pairs a month",
            "जस्तै: महिलाको चप्पल र सेन्डिल, साइज ३६–४१, महिनामा २०० जोडी जति",
          )}
        />
      </label>

      {state.message.en && !state.ok ? (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-800 md:col-span-2">
          {text(state.message.en, state.message.ne)}
        </p>
      ) : null}

      <div className="md:col-span-2">
        <SubmitButton
          idleLabel={text("Send enquiry", "सोधपुछ पठाउने")}
          pendingLabel={text("Sending…", "पठाउँदै…")}
        />
      </div>
    </form>
  );
}
