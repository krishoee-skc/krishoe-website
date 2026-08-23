"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { claimOrderAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";
import { useLanguage } from "@/components/LanguageProvider";

const initialState: AccountActionState = { ok: false, message: "" };

export default function OrderClaimForm() {
  const { text } = useLanguage();
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const form = event.currentTarget;
      const result = await claimOrderAction(state, new FormData(form));
      setState(result);

      if (result.ok && result.href) {
        form.reset();
        router.push(result.href);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">{text("Link guest order", "पुरानो अर्डर जोड्ने")}</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        Add a KRISHOE order reference to bring eligible guest orders into this account.
      </p>

      <label className="mt-5 grid gap-2 text-sm font-semibold text-brand-green-ink">
        {text("Order reference", "अर्डर नम्बर")}
        <input
          name="orderId"
          required
          autoComplete="off"
          placeholder="KRS-ORD-..."
          className="h-12 rounded-lg border border-black/10 px-4 font-mono text-sm font-normal uppercase outline-none focus:border-brand-green"
        />
      </label>

      <div className="mt-5 grid gap-2">
        <SubmitButton
          idleLabel={isPending ? "Linking order" : "Link order"}
          pendingLabel="Linking order"
          disabled={isPending}
        />
        {state.message ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-3 text-sm font-semibold ${
              state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-mist text-brand-clay"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
