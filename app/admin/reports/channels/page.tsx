import Link from "next/link";
import type { Metadata } from "next";
import CampaignLinkMaker from "@/app/admin/reports/channels/CampaignLinkMaker";
import { ArrowRightIcon } from "@/components/Icons";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { fetchAnalyticsSnapshot, type NamedCount } from "@/lib/google-analytics";

export const metadata: Metadata = { title: "कहाँबाट आयो | KRISHOE Admin" };

export const dynamic = "force-dynamic";

/**
 * The report that decides where the shop spends its next hour.
 *
 * Google's channel grouping puts Facebook, Instagram and TikTok into a single
 * bucket called Organic Social, so this page can say "twenty-one from social"
 * and never which of the three. That is the difference between knowing an
 * advert worked and knowing WHICH advert worked, and only the second is worth
 * anything to somebody deciding what to post tomorrow.
 *
 * So the limit is stated plainly at the top rather than hidden, and the cure
 * sits directly under it — the link maker, on the same screen, because advice
 * in a document is advice nobody follows. Tagging has to happen when the post
 * is written; nothing can recover it afterwards.
 */

/** Google's own English names, in the words the shop uses. */
const CHANNEL_LABELS: Record<string, { ne: string; detail: string }> = {
  "Organic Social": { ne: "Social — Facebook, Instagram, TikTok", detail: "पोस्ट देखेर आएका" },
  "Paid Social": { ne: "Social विज्ञापन", detail: "पैसा तिरेको विज्ञापनबाट" },
  "Organic Search": { ne: "Google खोजेर", detail: "खोजीमा भेटेर आएका" },
  "Paid Search": { ne: "Google विज्ञापन", detail: "खोजीको विज्ञापनबाट" },
  Direct: { ne: "सिधै ठेगाना टाइप गरेर", detail: "ठेगाना थाहा भएका" },
  Referral: { ne: "अर्को साइटको लिङ्कबाट", detail: "कसैले लिङ्क राखेको" },
  Email: { ne: "Email बाट", detail: "पठाइएको सन्देशबाट" },
  Unassigned: { ne: "थाहा नभएको", detail: "Google ले छुट्याउन सकेन" },
};

function label(channel: string) {
  return CHANNEL_LABELS[channel] ?? { ne: channel, detail: "" };
}

function Bar({ share }: { share: number }) {
  return (
    <span className="hidden h-2 flex-1 overflow-hidden rounded-full bg-brand-mist sm:block">
      <span
        className="block h-full rounded-full bg-brand-gold"
        style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
      />
    </span>
  );
}

export default async function ChannelsPage() {
  await requireAdminPermission("insights:read");

  const result = await fetchAnalyticsSnapshot(30);
  const channels: NamedCount[] = result.ok ? result.snapshot.channels : [];
  const total = channels.reduce((sum, row) => sum + row.count, 0);
  const busiest = channels[0];

  return (
    <section className="p-4 sm:p-6">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-muted transition hover:text-brand-green"
      >
        ← हिसाब
      </Link>

      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.22em] text-brand-gold-deep">
        हिसाब · कहाँबाट आयो
      </p>
      <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink">
        ग्राहक कुनबाट आए?
      </h1>

      {/* The answer, before anything else on the page. */}
      <div className="mt-5 rounded-2xl bg-brand-green-ink p-6 text-white sm:p-7">
        {result.ok ? (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
              पछिल्लो ३० दिन
            </p>
            <p className="mt-2 font-display text-[2.5rem] font-black leading-none sm:text-5xl">
              {total.toLocaleString("en-IN")}{" "}
              <span className="text-lg font-bold text-white/70">भ्रमण</span>
            </p>
            <p className="mt-3 text-sm text-white/70">
              {busiest
                ? `सबैभन्दा धेरै — ${label(busiest.label).ne}`
                : "अझै कोही आएको छैन।"}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-2xl font-black leading-snug">
              Google Analytics बाट डाटा आएन
            </p>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/70">{result.reason}</p>
          </>
        )}
      </div>

      {channels.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-brand-green-line bg-brand-paper">
          <p className="border-b border-brand-green-line px-5 py-4 text-sm font-black text-brand-green-ink">
            कुन बाटोबाट
          </p>
          <ul className="px-5 py-1">
            {channels.map((row) => (
              <li
                key={row.label}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-brand-mist py-3.5 last:border-0"
              >
                <span className="min-w-0 flex-grow">
                  <span className="block truncate text-sm font-bold text-brand-green-ink">
                    {label(row.label).ne}
                  </span>
                  {label(row.label).detail ? (
                    <span className="block text-xs text-brand-muted">{label(row.label).detail}</span>
                  ) : null}
                </span>
                <Bar share={total > 0 ? row.count / total : 0} />
                <span className="w-24 text-right text-sm font-black tabular-nums text-brand-green-ink">
                  {row.count} · {total > 0 ? Math.round((row.count / total) * 100) : 0}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* The limit, said plainly, with its cure immediately under it. */}
      <div className="mt-5 rounded-2xl border border-brand-gold bg-brand-cream-soft p-5 sm:p-6">
        <p className="text-base font-black text-brand-gold-ink">
          &ldquo;Social&rdquo; भन्छ, तर Facebook कि Instagram भन्दैन
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-green-ink">
          Google ले तीनवटैलाई एउटै झोलामा हाल्छ। छुट्याउने एउटै बाटो — पोस्ट गर्दा लिङ्कमा चिनो
          लगाउने। त्यो चिनो तल आफैँ बन्छ।
        </p>
      </div>

      <div className="mt-5">
        <CampaignLinkMaker />
      </div>

      <Link
        href="/admin/analytics"
        className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green transition hover:bg-brand-green hover:text-white"
      >
        कुन पाना धेरै हेरियो
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </section>
  );
}
