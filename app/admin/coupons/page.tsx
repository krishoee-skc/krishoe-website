import type { Metadata } from "next";
import { saveCouponAction } from "./actions";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { listCoupons } from "@/lib/coupons";

export const metadata: Metadata = { title: "छुटको कोड | KRISHOE Admin" };
export const dynamic = "force-dynamic";

const inputClass =
  "min-h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-green";

function rupees(paisa: number) {
  return `Rs. ${Math.round(paisa / 100).toLocaleString("en-IN")}`;
}

function nepaliDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminPermission("settings:write");
  const params = await searchParams;
  const coupons = await listCoupons();

  return (
    <section className="p-6 pb-24">
      <div>
        <h1 className="text-2xl font-black text-brand-green-ink">छुटको कोड</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-500">
          अभियान चलाउन कोड बनाउनुहोस् — TikTok को भिडियोमा, पर्चामा, वा ग्राहकलाई
          सिधै। ग्राहकले checkout मा हाल्छन्।
        </p>
      </div>

      {params?.success ? (
        <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          {params.success}
        </p>
      ) : null}
      {params?.error ? (
        <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
          {params.error}
        </p>
      ) : null}

      <form action={saveCouponAction} className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">नयाँ कोड बनाउने</h2>
        <p className="mt-1 text-sm text-gray-500">
          उही कोड फेरि हाल्दा पुरानै बदलिन्छ — नयाँ बन्दैन।
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            कोड
            <input name="code" required placeholder="DASHAIN10" className={`${inputClass} uppercase tracking-[0.14em]`} />
            <span className="text-xs font-normal text-gray-500">
              अंग्रेजी अक्षर र अंक मात्र। सानो-ठूलो अक्षरले फरक पर्दैन।
            </span>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            कस्तो छुट
            <select name="kind" defaultValue="percent" className={inputClass}>
              <option value="percent">प्रतिशत (%)</option>
              <option value="amount">तोकिएको रकम (Rs)</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            प्रतिशत भए — कति %
            <input name="percent" type="number" min="1" max="100" placeholder="10" className={inputClass} />
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            रकम भए — कति रुपैयाँ
            <input name="amountRupees" type="number" min="1" placeholder="200" className={inputClass} />
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            कम्तीमा कतिको किनमेल
            <input name="minOrderRupees" type="number" min="0" placeholder="1000" className={inputClass} />
            <span className="text-xs font-normal text-gray-500">खाली भए कुनै सीमा छैन।</span>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            प्रतिशतमा बढीमा कति छुट
            <input name="maxDiscountRupees" type="number" min="1" placeholder="500" className={inputClass} />
            <span className="text-xs font-normal text-gray-500">
              ठूलो अर्डरमा धेरै नजाओस् भनेर। खाली भए सीमा छैन।
            </span>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            कहिलेदेखि
            <input name="startsAt" type="date" className={inputClass} />
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            कहिलेसम्म
            <input name="expiresAt" type="date" className={inputClass} />
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            बढीमा कति पटक चल्ने
            <input name="maxUses" type="number" min="1" placeholder="100" className={inputClass} />
            <span className="text-xs font-normal text-gray-500">
              खाली भए असीमित। TikTok मा हाल्ने भए सीमा राख्नुहोस्।
            </span>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink">
            अवस्था
            <select name="status" defaultValue="Active" className={inputClass}>
              <option value="Active">चालु</option>
              <option value="Disabled">बन्द</option>
            </select>
          </label>

          <label className="grid gap-2 text-sm font-bold text-brand-green-ink md:col-span-2">
            टिप्पणी (आफ्नो सम्झनाका लागि)
            <input name="note" maxLength={240} placeholder="दशैँ अभियान — TikTok" className={inputClass} />
          </label>
        </div>

        <div className="mt-5">
          <FormSubmitButton
            className="min-h-12 rounded-xl bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:opacity-60"
            pendingLabel="सुरक्षित हुँदै…"
          >
            कोड सुरक्षित गर्ने
          </FormSubmitButton>
        </div>
      </form>

      <section className="mt-8">
        <h2 className="text-lg font-black text-brand-green-ink">बनेका कोड</h2>
        {coupons.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm font-semibold text-gray-500">
            अझै कुनै कोड बनेको छैन।
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {coupons.map((coupon) => {
              const exhausted = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;
              const expired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt) < new Date());
              const live = coupon.status === "Active" && !exhausted && !expired;

              return (
                <article key={coupon.code} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-lg font-black tracking-[0.14em] text-brand-green-ink">
                        {coupon.code}
                      </p>
                      <p className="text-sm font-bold text-brand-green">
                        {coupon.kind === "percent"
                          ? `${coupon.value}% छुट`
                          : `${rupees(coupon.value)} छुट`}
                        {coupon.maxDiscountPaisa
                          ? ` · बढीमा ${rupees(coupon.maxDiscountPaisa)}`
                          : ""}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-black ${
                        live ? "bg-emerald-100 text-emerald-900" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {live ? "चालु" : expired ? "म्याद सकियो" : exhausted ? "सकियो" : "बन्द"}
                    </span>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <dt className="font-black uppercase tracking-wider text-gray-400">कति पटक चल्यो</dt>
                      <dd className="mt-0.5 font-bold text-brand-green-ink">
                        {coupon.usedCount}
                        {coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wider text-gray-400">कम्तीमा किनमेल</dt>
                      <dd className="mt-0.5 font-bold text-brand-green-ink">
                        {coupon.minOrderPaisa > 0 ? rupees(coupon.minOrderPaisa) : "सीमा छैन"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wider text-gray-400">कहिलेदेखि</dt>
                      <dd className="mt-0.5 font-bold text-brand-green-ink">{nepaliDate(coupon.startsAt)}</dd>
                    </div>
                    <div>
                      <dt className="font-black uppercase tracking-wider text-gray-400">कहिलेसम्म</dt>
                      <dd className="mt-0.5 font-bold text-brand-green-ink">{nepaliDate(coupon.expiresAt)}</dd>
                    </div>
                  </dl>

                  {coupon.note ? (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{coupon.note}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
