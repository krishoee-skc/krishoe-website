"use client";

import { FormEvent, useState } from "react";
import type { SafeUser } from "@/lib/user-store";
import { updateProfileAction, type AccountActionState } from "@/app/account/actions";
import SubmitButton from "@/components/SubmitButton";

const initialState: AccountActionState = { ok: false, message: "" };

export default function ProfileEditForm({ user }: { user: SafeUser }) {
  const [state, setState] = useState<AccountActionState>(initialState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);

    try {
      setState(await updateProfileAction(state, new FormData(event.currentTarget)));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-black/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Saved profile</p>
      <h2 className="mt-3 text-xl font-black text-brand-green-ink">Account details</h2>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Full name
          <input
            name="name"
            defaultValue={user.name}
            required
            maxLength={80}
            autoComplete="name"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Email
          <input
            type="email"
            value={user.email}
            disabled
            className="h-12 rounded-lg border border-black/10 bg-brand-mist px-4 font-normal text-brand-muted"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={user.phone}
            maxLength={20}
            pattern="^\+?[0-9\s().-]{7,20}$"
            autoComplete="tel"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-brand-green"
            placeholder="+977 9800000000"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-brand-green-ink">
          Default address
          <textarea
            name="address"
            defaultValue={user.address}
            rows={4}
            maxLength={600}
            autoComplete="street-address"
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-brand-green"
            placeholder="City, area, landmark"
          />
        </label>
      </div>
      <div className="mt-6 grid gap-2">
        <SubmitButton
          idleLabel={isPending ? "Saving changes" : "Save changes"}
          pendingLabel="Saving changes"
          disabled={isPending}
        />
        {state.message && (
          <p
            aria-live="polite"
            className={`rounded-lg p-3 text-sm font-semibold ${
              state.ok ? "bg-brand-green-mist text-brand-green" : "bg-brand-clay-mist text-brand-clay"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
