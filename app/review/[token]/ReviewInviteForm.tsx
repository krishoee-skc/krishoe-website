"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { submitInvitedReview, type ReviewFormState } from "./actions";

/**
 * The whole of what a customer has to do to leave a review.
 *
 * Five taps and a sentence, on a phone, with no account and no password. Every
 * field beyond the stars and the words is a reason to close the tab — the name
 * is optional because the order already has one, and the shop would rather have
 * an unsigned review than none.
 */

const START: ReviewFormState = { ok: false, message: "" };

const WORDS = ["नराम्रो", "ठीकै छैन", "ठीकै", "राम्रो", "धेरै राम्रो"];

export default function ReviewInviteForm({
  token,
  productName,
  defaultName,
}: {
  token: string;
  productName: string;
  defaultName: string;
}) {
  const [state, action, pending] = useActionState(
    submitInvitedReview.bind(null, token),
    START,
  );
  const [rating, setRating] = useState(0);

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <p className="text-5xl">🙏</p>
        <p className="mt-4 text-lg font-black text-emerald-900">{state.message}</p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-xl bg-brand-green-ink px-6 py-3 text-sm font-black text-white"
        >
          पसल हेर्ने
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <fieldset>
        <legend className="text-base font-black text-brand-green-ink">
          {productName} कस्तो लाग्यो?
        </legend>

        {/* Radios rather than buttons: the star row has to work before the
            JavaScript arrives, and it has to be reachable from a keyboard. */}
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className="cursor-pointer p-1 text-4xl leading-none"
              title={WORDS[value - 1]}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                required
                className="sr-only"
                onChange={() => setRating(value)}
              />
              <span className={value <= rating ? "text-amber-500" : "text-gray-300"}>★</span>
            </label>
          ))}
        </div>
        <p className="mt-1 h-5 text-sm font-bold text-amber-700">
          {rating > 0 ? WORDS[rating - 1] : ""}
        </p>
      </fieldset>

      <label className="block">
        <span className="text-sm font-bold text-gray-800">दुई शब्द लेख्नुहोस्</span>
        <textarea
          name="comment"
          required
          minLength={5}
          maxLength={1200}
          rows={4}
          placeholder="साइज कस्तो थियो? टिकाउ छ? अरूलाई सुझाउनुहुन्छ?"
          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold text-gray-800">
          नाम <span className="font-normal text-gray-500">— नलेखे पनि हुन्छ</span>
        </span>
        <input
          type="text"
          name="name"
          defaultValue={defaultName}
          maxLength={80}
          className="mt-1 w-full rounded-xl border border-gray-300 px-4 py-3 text-base"
        />
      </label>

      {state.message ? (
        <p className="rounded-xl bg-brand-clay-tint px-4 py-3 text-sm font-bold text-brand-clay">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-brand-green-ink px-6 py-4 text-base font-black text-white disabled:opacity-60"
      >
        {pending ? "पठाउँदै…" : "राय पठाउने"}
      </button>

      <p className="text-center text-xs leading-5 text-gray-500">
        तपाईंको राय KRISHOE ले हेरेर मात्र पसलमा देखाइन्छ।
      </p>
    </form>
  );
}
