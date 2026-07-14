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
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">Saved profile</p>
      <h2 className="mt-3 text-xl font-black text-[#10231D]">Account details</h2>
      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Full name
          <input
            name="name"
            defaultValue={user.name}
            required
            maxLength={80}
            autoComplete="name"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Email
          <input
            type="email"
            value={user.email}
            disabled
            className="h-12 rounded-lg border border-black/10 bg-[#F5F7F4] px-4 font-normal text-[#5F6B66]"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={user.phone}
            maxLength={20}
            pattern="^\+?[0-9\s().-]{7,20}$"
            autoComplete="tel"
            className="h-12 rounded-lg border border-black/10 px-4 font-normal outline-none focus:border-[#0B4D3B]"
            placeholder="+977 9800000000"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-[#10231D]">
          Default address
          <textarea
            name="address"
            defaultValue={user.address}
            rows={4}
            maxLength={600}
            autoComplete="street-address"
            className="rounded-lg border border-black/10 px-4 py-3 font-normal outline-none focus:border-[#0B4D3B]"
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
              state.ok ? "bg-[#E9F2EE] text-[#0B4D3B]" : "bg-[#FFF1EF] text-[#7B3128]"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
