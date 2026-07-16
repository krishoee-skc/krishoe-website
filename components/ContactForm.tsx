"use client";

import { FormEvent, useState } from "react";
import { submitContact, type FormState } from "@/app/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: FormState = {
  ok: false,
  message: "",
};

export default function ContactForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      const result = await submitContact(state, new FormData(event.currentTarget));
      setState(result);

      if (result.ok) {
        event.currentTarget.reset();
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6 shadow-[0_24px_70px_rgba(16,35,29,0.08)]">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Send a request</p>
      <h2 className="mt-3 text-3xl font-black text-brand-green-ink">Talk to KRISHOE</h2>

      <div className="mt-7 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Name
          <input
            name="name"
            required
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
            placeholder="Your name"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Email
          <input
            name="email"
            required
            type="email"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Message
          <textarea
            name="message"
            required
            rows={5}
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
            placeholder="Tell us what you are looking for"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-3">
        <SubmitButton
          idleLabel={isPending ? "Sending message" : "Send message"}
          pendingLabel="Sending message"
          disabled={isPending}
        />
        {state.message ? (
          <p
            aria-live="polite"
            className={`rounded-lg p-4 text-sm font-semibold ${
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
