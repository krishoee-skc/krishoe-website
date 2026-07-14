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
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">Send a request</p>
      <h2 className="mt-3 text-3xl font-black text-[#10231D]">Talk to KRISHOE</h2>

      <div className="mt-7 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Name
          <input
            name="name"
            required
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="Your name"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Email
          <input
            name="email"
            required
            type="email"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="you@example.com"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Message
          <textarea
            name="message"
            required
            rows={5}
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-[#0B4D3B]"
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
              state.ok ? "bg-[#E9F2EE] text-[#0B4D3B]" : "bg-[#FFF1EF] text-[#7B3128]"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
