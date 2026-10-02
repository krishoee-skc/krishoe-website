"use client";

import { useActionState, useState } from "react";
import { askOwnerAction, type AskState } from "./actions";

/** One form, two questions: "the sum is wrong" and "an advance, please". */
export default function AskForm({ start }: { start: "hisab" | "advance" }) {
  const [kind, setKind] = useState<"hisab" | "advance">(start);
  const [state, action, pending] = useActionState<AskState, FormData>(askOwnerAction, null);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="के भन्ने?">
        {[
          { value: "hisab", label: "⚖️ हिसाब मिलेन" },
          { value: "advance", label: "💵 पेस्की माग्ने" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={kind === item.value}
            onClick={() => setKind(item.value as "hisab" | "advance")}
            className={`min-h-14 rounded-2xl border-2 text-lg font-black ${kind === item.value ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {kind === "advance" ? (
        <label className="grid gap-1 text-lg font-black">
          कति रकम? (Rs.)
          <input name="amount" inputMode="numeric" required className="min-h-14 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-2xl" />
        </label>
      ) : (
        <label className="grid gap-1 text-lg font-black">
          कुन दिनको? <span className="text-base font-semibold text-brand-muted">(थाहा भए)</span>
          <input name="aboutDate" type="date" className="min-h-14 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-lg" />
        </label>
      )}

      <label className="grid gap-1 text-lg font-black">
        {kind === "advance" ? "किन चाहिएको? (नभरे पनि हुन्छ)" : "के नमिलेको हो?"}
        <textarea
          name="message"
          rows={3}
          maxLength={500}
          required={kind === "hisab"}
          placeholder={kind === "advance" ? "जस्तै: घरमा खर्च" : "जस्तै: बुधबार ४० जोडी बनाएँ, ३० मात्र देखियो"}
          className="rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 py-3 text-lg"
        />
      </label>

      <button type="submit" disabled={pending} className="min-h-16 rounded-2xl bg-brand-green px-4 text-xl font-black text-white disabled:opacity-50">
        {pending ? "पठाउँदै…" : "➤ मालिकलाई पठाउने"}
      </button>
      {state ? (
        <p role="status" className={`rounded-2xl px-4 py-3 text-lg font-black ${state.ok ? "bg-brand-green-wash text-brand-green" : "bg-red-50 text-red-800"}`}>
          {state.text}
        </p>
      ) : null}
    </form>
  );
}
