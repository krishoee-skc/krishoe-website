import Link from "next/link";
import T from "@/components/T";
import { goalProgress, type BusinessGoal } from "@/lib/business-goals";

/**
 * This month's goal, and how far along the shop is.
 *
 * Shown near the top of the owner's dashboard so the day's numbers read against
 * a target — "Rs. 8,500 of Rs. 40,000, 21%" instead of a bare figure. Three
 * lines: sales, profit, pairs made. A line whose goal is zero is not tracked, so
 * it shows a quiet "set a goal" link instead of a bar — the card is never a row
 * of empty or broken bars. When no goal at all is set, the whole card is a
 * single friendly invitation to set one.
 *
 * Read-only: it shows figures computed elsewhere and links to Settings to change
 * the goal. Nothing here writes.
 */

const money = (value: number) => `Rs. ${Math.round(value).toLocaleString("en-IN")}`;

function Bar({ percent }: { percent: number }) {
  // Cap the fill at 100% so an over-goal month does not overflow the track, but
  // the label still shows the true percent (e.g. 120%).
  const width = Math.min(100, Math.max(0, percent));
  const done = percent >= 100;
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-brand-green-mist">
      <div
        className={`h-full rounded-full transition-all ${done ? "bg-brand-green" : "bg-brand-gold"}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function GoalLine({
  label,
  achieved,
  goal,
  isMoney,
}: {
  label: React.ReactNode;
  achieved: number;
  goal: number;
  isMoney: boolean;
}) {
  const { percent } = goalProgress(achieved, goal);
  const fmt = (n: number) => (isMoney ? money(n) : `${n}`);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-bold text-brand-green-ink">{label}</span>
        {percent === null ? (
          <Link
            href="/admin/settings#goals"
            className="text-xs font-bold text-brand-gold-deep underline underline-offset-2"
          >
            <T en="Set a goal" ne="लक्ष्य राख्नुहोस्" />
          </Link>
        ) : (
          <span className="text-xs font-black tabular-nums text-brand-green">
            {percent}%
          </span>
        )}
      </div>
      {percent === null ? null : (
        <>
          <Bar percent={percent} />
          <p className="mt-1 text-xs text-brand-muted tabular-nums">
            {fmt(achieved)} <span className="text-brand-muted-soft">/ {fmt(goal)}</span>
          </p>
        </>
      )}
    </div>
  );
}

export default function GoalCard({
  goal,
  monthSales,
  monthProfit,
  monthPairs,
}: {
  goal: BusinessGoal;
  monthSales: number;
  monthProfit: number;
  monthPairs: number;
}) {
  const anyGoalSet = goal.salesGoal > 0 || goal.profitGoal > 0 || goal.productionGoal > 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-gold/40 bg-gradient-to-br from-brand-gold/10 to-transparent p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-xl">🎯</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-gold-deep">
              <T en="This month's goal" ne="यो महिनाको लक्ष्य" />
            </p>
            <p className="font-display text-lg font-black leading-tight text-brand-green-ink">
              {goal.monthKey}
            </p>
          </div>
        </div>
        <Link
          href="/admin/settings#goals"
          className="shrink-0 rounded-full border border-brand-green-line px-3 py-1.5 text-xs font-bold text-brand-green transition hover:border-brand-green"
        >
          <T en="Edit goal" ne="लक्ष्य मिलाउने" />
        </Link>
      </div>

      {anyGoalSet ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <GoalLine label={<T en="Sales this month" ne="यो महिनाको बिक्री" />} achieved={monthSales} goal={goal.salesGoal} isMoney />
          <GoalLine label={<T en="Profit this month" ne="यो महिनाको नाफा" />} achieved={monthProfit} goal={goal.profitGoal} isMoney />
          {/* Production is shown as today's pairs against the monthly goal only
              when a production goal is set — labelled "today" so it is honest
              that this is the day, not the month's running total (a month-to-
              date pair count isn't computed yet). Sales and profit above are the
              month's real running totals. */}
          {goal.productionGoal > 0 ? (
            <div className="sm:col-span-2">
              <GoalLine
                label={<T en="Pairs made today" ne="आज बनेको जोडी" />}
                achieved={monthPairs}
                goal={goal.productionGoal}
                isMoney={false}
              />
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          <T
            en="No goal set for this month yet. Set a sales, profit and production target so the day's numbers show how close you are."
            ne="यो महिनाको लक्ष्य अझै राखिएको छैन। बिक्री, नाफा र उत्पादनको लक्ष्य राख्नुहोस् — अनि आजको नम्बरले कति नजिक हुनुहुन्छ देखाउँछ।"
          />{" "}
          <Link href="/admin/settings#goals" className="font-bold text-brand-green underline">
            <T en="Set this month's goal" ne="यो महिनाको लक्ष्य राख्नुहोस्" />
          </Link>
        </p>
      )}
    </section>
  );
}
