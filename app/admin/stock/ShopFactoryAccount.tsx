"use client";

import { useActionState, useState } from "react";
import ActionMessage from "@/components/admin/ActionMessage";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { useLanguage } from "@/components/LanguageProvider";
import type { ActionState } from "@/app/admin/actions";
import { addShopFactoryPaymentAction, removeShopFactoryPaymentAction } from "@/app/admin/stock/actions";
import { money } from "@/lib/format-money";
import type { ShopFactoryAccount as Account } from "@/lib/shop-factory-account";

/**
 * The shop's account with the factory (owner, 2026-10-31, two businesses,
 * choice 2(a)): what the shop took on challans, what it paid, what it owes —
 * and the box to keep a payment. A payment typed wrong is removed by the
 * Owner, with the reason; it stays on file.
 */
export default function ShopFactoryAccount({
  account,
  today,
  canPay,
  canRemove,
  isOwner,
}: {
  /** Null until the Owner's Settings OK for the payments table. */
  account: Account | null;
  today: string;
  canPay: boolean;
  canRemove: boolean;
  isOwner: boolean;
}) {
  const { text } = useLanguage();
  const [state, pay, paying] = useActionState<ActionState | null, FormData>(addShopFactoryPaymentAction, null);
  const [removeState, remove, removing] = useActionState<ActionState | null, FormData>(removeShopFactoryPaymentAction, null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (!account) {
    return (
      <section id="shop-factory-account" className="scroll-mt-24 rounded-2xl border border-[#2F5C8A]/30 bg-[#EAF1F8] p-4 text-sm font-bold text-[#2F5C8A] sm:p-5">
        {isOwner
          ? text(
              "🛒 → 🏭 The shop's account with the factory waits for one database step: Settings › Setup and system › the two businesses card, OK.",
              "🛒 → 🏭 पसल → कारखाना हिसाबका लागि database को एउटा काम बाँकी छ: Settings › Setup and system › दुई व्यापार कार्डमा OK थिच्नुहोस्।",
            )
          : text("🛒 → 🏭 The shop's account with the factory is not set up yet.", "🛒 → 🏭 पसल → कारखाना हिसाब अझै तयार छैन।")}
      </section>
    );
  }

  const box =
    "h-11 rounded-md border border-brand-green-line bg-brand-paper px-3 text-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";
  const figures = [
    { en: "Shop took (challans)", ne: "पसलले लिएको (challan)", value: account.bought - account.returned },
    { en: "Paid", ne: "तिरेको", value: account.paid },
    { en: "Still owed", ne: "तिर्न बाँकी", value: account.owed, strong: true },
  ];

  return (
    <section id="shop-factory-account" className="scroll-mt-24 rounded-2xl border border-[#2F5C8A]/30 bg-brand-paper p-4 sm:p-5">
      <h2 className="text-lg font-black text-brand-green-ink">{text("🛒 Shop → 🏭 Factory account", "🛒 पसल → 🏭 कारखाना हिसाब")}</h2>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-brand-muted">
        {text(
          "Made shoes the shop counted in from the factory, at their factory price, less those sent back; what the shop paid; and what it still owes.",
          "पसलले कारखानाबाट बुझेका बनाएका जुत्ता (कारखाना मूल्यमा), फिर्ता पठाएको घटाएर; पसलले तिरेको; र तिर्न बाँकी।",
        )}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {figures.map((figure) => (
          <div key={figure.en} className="rounded-xl bg-brand-paper-deep px-3 py-2">
            <p className={`text-xl font-black tabular-nums ${figure.strong ? "text-[#2F5C8A]" : "text-brand-green-ink"}`}>{money(figure.value)}</p>
            <p className="text-xs font-bold text-brand-muted">{text(figure.en, figure.ne)}</p>
          </div>
        ))}
      </div>
      {account.onRoad > 0 ? (
        <p className="mt-2 text-xs font-bold text-brand-gold-ink">
          {text(
            `${money(account.onRoad)} more is on the road — owed once the shop counts it in.`,
            `${money(account.onRoad)} अझै बाटोमा छ — पसलले बुझेपछि मात्र तिर्न बाँकीमा जोडिन्छ।`,
          )}
        </p>
      ) : null}

      {canPay ? (
        <EnterWalkForm action={pay} className="mt-4 grid gap-2">
          <p className="text-sm font-black text-brand-green-ink">{text("Keep a payment", "तिरेको लेख्ने")}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input name="amount" type="number" min="1" step="0.01" inputMode="decimal" required placeholder={text("Rs. paid", "तिरेको Rs.")} aria-label={text("Amount paid", "तिरेको रकम")} className={`${box} tabular-nums`} />
            <select name="method" defaultValue="Cash" aria-label={text("How it was paid", "कसरी तिरेको")} className={box}>
              <option value="Cash">{text("Cash", "नगद")}</option>
              <option value="Bank">{text("Bank", "बैंक")}</option>
              <option value="Cheque">{text("Cheque", "चेक")}</option>
            </select>
            <input name="paidOn" type="date" required defaultValue={today} max={today} aria-label={text("Day paid", "तिरेको मिति")} className={box} />
          </div>
          <input name="note" maxLength={200} placeholder={text("Note (optional)", "टिपोट (चाहिए)")} aria-label={text("Note", "टिपोट")} className={box} />
          <button type="submit" disabled={paying} className="min-h-11 w-max rounded-xl bg-brand-green px-5 text-sm font-black text-white disabled:opacity-50">
            {paying ? text("Keeping…", "राख्दै…") : text("Keep the payment", "तिरेको राख्ने")}
          </button>
          <ActionMessage state={state} />
        </EnterWalkForm>
      ) : null}

      {account.payments.length > 0 ? (
        <ul className="mt-4 divide-y divide-brand-green-line border-t border-brand-green-line text-sm">
          {account.payments.map((payment) => (
            <li key={payment.id} className="grid gap-1 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b className="tabular-nums">{payment.paidOn}</b> · {payment.method === "Cash" ? text("Cash", "नगद") : payment.method === "Bank" ? text("Bank", "बैंक") : text("Cheque", "चेक")}
                  {payment.note ? <span className="text-brand-muted"> · {payment.note}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  <b className="tabular-nums text-brand-green-ink">{money(payment.amount)}</b>
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => setRemovingId(removingId === payment.id ? null : payment.id)}
                      className="min-h-9 rounded-lg border border-brand-clay/50 px-2 text-xs font-black text-brand-clay"
                    >
                      {text("Remove", "हटाउने")}
                    </button>
                  ) : null}
                </span>
              </div>
              {removingId === payment.id ? (
                <form action={remove} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={payment.id} />
                  <input name="reason" required maxLength={200} placeholder={text("Why (required)", "किन (अनिवार्य)")} aria-label={text("Why it is removed", "किन हटाउने")} className={`${box} flex-1`} />
                  <button type="submit" disabled={removing} className="min-h-11 rounded-xl bg-brand-clay px-4 text-sm font-black text-white disabled:opacity-50">
                    {text("Remove it", "हटाउने")}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <ActionMessage state={removeState} />
    </section>
  );
}
