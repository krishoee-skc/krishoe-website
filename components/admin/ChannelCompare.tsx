import T from "@/components/T";
import { money } from "@/lib/format-money";
import ProgressRing from "@/components/admin/ProgressRing";

/**
 * Today's sales split across the three channels — Retail, Wholesale, Online —
 * so the owner sees at a glance which one is carrying the day. Each channel is a
 * row with its net sales and a bar drawn to the busiest channel's share, plus
 * the bill count, so a quiet channel and a busy one read apart instantly.
 *
 * These are the shop's own numbers from the POS day-close snapshot; this only
 * arranges them. A day with no sales shows a calm "no sales yet today" rather
 * than three empty bars.
 */

type ChannelRow = {
  channel: "Retail" | "Wholesale" | "Online";
  invoiceCount: number;
  netTotal: number;
};


const CHANNEL_LABEL: Record<ChannelRow["channel"], { en: string; ne: string; icon: string }> = {
  Retail: { en: "Retail", ne: "खुद्रा", icon: "🛍️" },
  Wholesale: { en: "Wholesale", ne: "थोक", icon: "📦" },
  Online: { en: "Online", ne: "अनलाइन", icon: "🌐" },
};

export default function ChannelCompare({ rows }: { rows: ChannelRow[] }) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, row.netTotal), 0);
  const busiest = Math.max(0, ...rows.map((row) => Math.max(0, row.netTotal)));
  // Sorted so the strongest channel sits on top — the shop's real picture.
  const sorted = [...rows].sort((a, b) => b.netTotal - a.netTotal);
  // The leading channel's share of today's sales, drawn as a ring so the
  // concentration reads at a glance — is one channel carrying the day, or is it
  // spread evenly?
  const topShare = total > 0 ? Math.round((busiest / total) * 100) : 0;

  return (
    <section className="rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {total > 0 ? <ProgressRing percent={topShare} tone="good" /> : null}
          <div>
            <h2 className="font-display text-lg font-black text-brand-green-ink">
              <T en="Sales by channel — today" ne="channel अनुसार बिक्री — आज" />
            </h2>
            {total > 0 ? (
              <p className="text-xs text-brand-muted">
                <T
                  en={`Top channel is ${topShare}% of today`}
                  ne={`मुख्य channel — आजको ${topShare}%`}
                />
              </p>
            ) : null}
          </div>
        </div>
        <span className="text-sm font-black tabular-nums text-brand-green">{money(total)}</span>
      </div>

      {total <= 0 ? (
        <p className="mt-3 text-sm text-brand-muted">
          <T en="No sales yet today." ne="आज अझै बिक्री भएको छैन।" />
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sorted.map((row) => {
            const label = CHANNEL_LABEL[row.channel];
            const width = busiest > 0 ? Math.round((Math.max(0, row.netTotal) / busiest) * 100) : 0;
            const share = total > 0 ? Math.round((Math.max(0, row.netTotal) / total) * 100) : 0;
            return (
              <div key={row.channel}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-bold text-brand-green-ink">
                    <span aria-hidden="true">{label.icon}</span> <T en={label.en} ne={label.ne} />
                  </span>
                  <span className="tabular-nums text-brand-green-ink">
                    {money(row.netTotal)}
                    <span className="ml-1.5 text-xs font-normal text-brand-muted">{share}%</span>
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-brand-green-mist">
                  <div className="h-full rounded-full bg-brand-gold" style={{ width: `${width}%` }} />
                </div>
                <p className="mt-1 text-xs text-brand-muted tabular-nums">
                  <T en={`${row.invoiceCount} bills`} ne={`${row.invoiceCount} बिल`} />
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
