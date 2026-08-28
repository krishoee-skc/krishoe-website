import Link from "next/link";
import type { Metadata } from "next";
import AlertText from "@/components/admin/AlertText";
import { ArrowRightIcon } from "@/components/Icons";
import { getRobotsDashboard, type RobotCard, type RobotGroup, type RobotTone } from "@/lib/robots-status";

export const metadata: Metadata = { title: "Robots | KRISHOE Admin" };

export const dynamic = "force-dynamic";

/**
 * Robot दरबार — one control room for the eight jobs that run on their own.
 *
 * A summary at the top, then the robots in the three groups they belong to:
 * the ones that run on a schedule, the ones that watch quietly, and the one
 * that waits to be asked. Each card shows only status and a way in; the detail
 * lives on its own screen, reached by the card's link. Nothing here duplicates
 * a report — it is the switch board, not the room.
 */

// One palette. Green for the robots that are working or watching (both are
// healthy states), the brand gold for the one that waits to be asked, and a
// quiet brand neutral for the job that lives on GitHub. No borrowed blues.
const toneStyles: Record<RobotTone, string> = {
  run: "border-emerald-200 bg-emerald-50 text-emerald-700",
  watch: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ready: "border-brand-green-line bg-brand-mist text-brand-gold-ink",
  external: "border-brand-green-line bg-brand-mist text-brand-muted",
};

const toneDot: Record<RobotTone, string> = {
  run: "bg-emerald-500",
  watch: "bg-emerald-500",
  ready: "bg-brand-gold",
  external: "bg-brand-muted-soft",
};

const groupMeta: Record<RobotGroup, { en: string; ne: string }> = {
  scheduled: { en: "Runs on a schedule", ne: "समयमा आफै चल्ने" },
  guard: { en: "Watches quietly", ne: "चुपचाप पहरा दिने" },
  ondemand: { en: "Works on demand", ne: "माग्दा काम गर्ने" },
};

const groupEmoji: Record<RobotGroup, string> = {
  scheduled: "⏱",
  guard: "🛡",
  ondemand: "🖐",
};

function Card({ card }: { card: RobotCard }) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-xl border border-brand-green-line bg-brand-mist text-xl">
          {card.emoji}
        </span>
        <h3 className="font-display text-lg font-bold leading-tight text-brand-green-ink">
          <AlertText en={card.nameEn} ne={card.nameNe} />
        </h3>
      </div>
      <p className="flex-grow text-[13px] leading-6 text-brand-muted">
        <AlertText en={card.jobEn} ne={card.jobNe} />
      </p>
      <span
        className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${toneStyles[card.tone]}`}
      >
        <span className={`h-2 w-2 rounded-full ${toneDot[card.tone]}`} />
        <AlertText en={card.statusEn} ne={card.statusNe} />
      </span>
      <div className="flex items-center justify-between gap-3 border-t border-dashed border-brand-green-line pt-3">
        <span className="text-xs text-brand-muted-soft tabular-nums">
          <AlertText en={card.metaEn} ne={card.metaNe} />
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-brand-green">
          <AlertText en="View" ne="हेर्ने" />
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </div>
    </>
  );

  const cardClass =
    "group flex flex-col gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold";

  if (card.external) {
    return (
      <a href={card.href} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {body}
      </a>
    );
  }

  return (
    <Link href={card.href} className={cardClass}>
      {body}
    </Link>
  );
}

function Group({ group, cards }: { group: RobotGroup; cards: RobotCard[] }) {
  const rows = cards.filter((card) => card.group === group);
  if (rows.length === 0) return null;

  return (
    <div className="mt-7 first:mt-2">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-black uppercase tracking-[0.16em] text-brand-muted">
          {groupEmoji[group]} <AlertText en={groupMeta[group].en} ne={groupMeta[group].ne} />
        </span>
        <span className="h-px flex-1 bg-brand-green-line" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((card) => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

export default async function AdminRobotsPage() {
  const { health, cards } = await getRobotsDashboard();
  const uptimeLabel = health.uptimePercent === null ? "—" : `${health.uptimePercent}%`;
  const ringPercent = health.uptimePercent ?? 0;

  return (
    <section className="p-4 sm:p-6">
      <div className="overflow-hidden rounded-3xl border border-brand-green-line bg-brand-paper shadow-sm">
        {/* header + health */}
        <div className="flex flex-wrap items-end justify-between gap-5 border-b border-brand-green-line bg-brand-mist/50 p-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-brand-gold-deep">
              <AlertText en="Automation · Robots" ne="Robot दरबार · स्वचालन" />
            </p>
            <h1 className="mt-2 font-display text-3xl font-black leading-tight text-brand-green-ink sm:text-4xl">
              <AlertText en="Your robots, at a glance" ne="तपाईंका Robot, एकै नजरमा" />
            </h1>
            <p className="mt-2 max-w-[52ch] text-sm leading-6 text-brand-muted">
              <AlertText
                en="Everything the shop does on its own — what each robot is doing, and the way in. Nothing scattered."
                ne="पसल आफैले गर्ने सबै — कुन robot ले के गर्दैछ, र हेर्ने बाटो। केही छरिएको छैन।"
              />
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div
              className="grid h-[74px] w-[74px] flex-none place-items-center rounded-full"
              style={{
                background: `conic-gradient(#C8A04D ${ringPercent}%, #E4DFD5 0)`,
              }}
            >
              <span className="grid h-[58px] w-[58px] place-items-center rounded-full bg-brand-paper font-display text-sm font-black text-brand-green-ink tabular-nums shadow-sm">
                {uptimeLabel}
              </span>
            </div>
            <div>
              <p className="font-display text-2xl font-black leading-none text-brand-green-ink tabular-nums">
                {health.activeCount}
              </p>
              <p className="mt-1 text-xs text-brand-muted">
                <AlertText
                  en={`robots active · ${health.errorsToday} error(s) today`}
                  ne={`robot चालु · आज error: ${health.errorsToday}`}
                />
              </p>
            </div>
          </div>
        </div>

        {/* robots by group */}
        <div className="p-5 sm:p-6">
          <Group group="scheduled" cards={cards} />
          <Group group="guard" cards={cards} />
          <Group group="ondemand" cards={cards} />

          {/* how it works */}
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-brand-gold bg-brand-mist/50 p-4">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-gold text-xs font-black text-brand-green-ink">1</span>
              <p className="text-[13px] leading-6 text-brand-green-ink">
                <AlertText
                  en="One place: every robot's status in one view, never scattered."
                  ne="एउटै ठाउँ: सबै robot को स्थिति एकै नजरमा, छरिएको छैन।"
                />
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-brand-gold bg-brand-mist/50 p-4">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-gold text-xs font-black text-brand-green-ink">2</span>
              <p className="text-[13px] leading-6 text-brand-green-ink">
                <AlertText
                  en="View takes you in: tap a card to open its detailed screen."
                  ne="हेर्ने ले लैजान्छ: card थिच्दा विस्तृत page मा पुगिन्छ।"
                />
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-dashed border-brand-gold bg-brand-mist/50 p-4">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-gold text-xs font-black text-brand-green-ink">3</span>
              <p className="text-[13px] leading-6 text-brand-green-ink">
                <AlertText
                  en="No duplication: the detail stays in its own home — this is the switch board."
                  ne="दोहोरिँदैन: विवरण आफ्नै घरमै — यो त switch board मात्र।"
                />
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
