import T from "@/components/T";
import FormSubmitButton from "@/components/admin/FormSubmitButton";
import { backupNowAction } from "@/app/admin/notifications/actions";
import { formatAdminDate } from "@/lib/format-date";
import type { NightlyOutcome, NightlyRun } from "@/lib/nightly-jobs";
import type { StoredBackup } from "@/lib/scheduled-backup";

/**
 * What the evening jobs did, at a glance: each job's latest run, whether it
 * worked, and what it said. Owners also get the weekly backups — download one,
 * or make one now.
 */

const chip: Record<NightlyOutcome, { className: string; en: string; ne: string }> = {
  ok: { className: "bg-emerald-50 text-emerald-800", en: "✅ Done", ne: "✅ भयो" },
  skipped: { className: "bg-brand-mist text-brand-muted-deep", en: "⚪ Skipped", ne: "⚪ छोडियो" },
  failed: { className: "bg-red-50 text-red-700", en: "❌ Failed", ne: "❌ असफल" },
};

/** The evening run happens once a day; older than this means it stopped. */
const STALE_MS = 26 * 60 * 60 * 1000;

function megabytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 1024 * 1024 ? 2 : 1)} MB`;
}

export default function EveningJobs({
  runs,
  nowMs,
  backups,
}: {
  runs: NightlyRun[];
  nowMs: number;
  /** Present for the Owner only: the stored weekly backups and whether they can be made. */
  backups?: { ready: boolean; stored: StoredBackup[] };
}) {
  const newest = runs.reduce((latest, run) => (run.at > latest ? run.at : latest), "");
  const stale = newest ? nowMs - new Date(newest).getTime() > STALE_MS : false;

  return (
    <section id="evening-jobs" className="mt-8 scroll-mt-24 rounded-2xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
      <h2 className="text-lg font-black text-brand-green-ink">
        🌙 <T en="Evening jobs" ne="रातको काम" />
      </h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
        <T
          en="What ran on its own at 8 pm (retried at 9 pm): the reports, review requests, closing unused staff accounts and the weekly backup. A failure is also sent to the Owner's phone."
          ne="राति ८ बजे आफैँ चल्ने काम (९ बजे फेरि प्रयास): रिपोर्ट, review अनुरोध, नचलाएका staff account बन्द गर्ने, र साप्ताहिक backup। असफल भए Owner को फोनमा पनि सूचना जान्छ।"
        />
      </p>

      {stale ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          <T
            en={`⚠️ No evening run since ${formatAdminDate(newest, { time: true })}. The evening jobs may have stopped.`}
            ne={`⚠️ ${formatAdminDate(newest, { time: true })} पछि रातको काम चलेको छैन। रातको काम रोकिएको हुन सक्छ।`}
          />
        </p>
      ) : null}

      {runs.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-brand-muted">
              <tr>
                <th className="py-2 pr-3 font-black"><T en="Job" ne="काम" /></th>
                <th className="py-2 pr-3 font-black"><T en="Result" ne="नतिजा" /></th>
                <th className="py-2 pr-3 font-black"><T en="Last run" ne="अन्तिम पटक" /></th>
                <th className="py-2 font-black"><T en="What it said" ne="के भन्यो" /></th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.job} className="border-t border-brand-green-line align-top">
                  <td className="py-2 pr-3 font-bold text-brand-green-ink"><T en={run.label.en} ne={run.label.ne} /></td>
                  <td className="py-2 pr-3">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${chip[run.outcome].className}`}>
                      <T en={chip[run.outcome].en} ne={chip[run.outcome].ne} />
                    </span>
                  </td>
                  <td className="whitespace-nowrap py-2 pr-3 text-xs text-brand-muted">{formatAdminDate(run.at, { time: true })}</td>
                  <td className="py-2 text-xs leading-5 text-brand-muted">{run.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-brand-mist px-4 py-3 text-sm font-semibold text-brand-muted">
          <T
            en="No evening run recorded yet. The first appears after 8 pm."
            ne="अहिलेसम्म रातको काम दर्ता भएको छैन। पहिलो राति ८ बजेपछि देखिन्छ।"
          />
        </p>
      )}

      {backups ? (
        <div className="mt-6 border-t border-brand-green-line pt-5">
          <h3 className="text-base font-black text-brand-green-ink">
            🗄️ <T en="Weekly backups" ne="साप्ताहिक backup" />
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-brand-muted">
            <T
              en="A locked copy of the shop's books is kept every week; the last 8 are kept. Downloading gives the same file as Activity → Export backup."
              ne="हरेक हप्ता पसलको खाताको ताला लगाइएको प्रति राखिन्छ; पछिल्ला ८ वटा रहन्छन्। Download गर्दा Activity → Export backup जस्तै फाइल आउँछ।"
            />
          </p>
          {!backups.ready ? (
            <p className="mt-3 rounded-xl bg-brand-clay-mist px-4 py-3 text-sm font-bold text-brand-clay">
              <T
                en="Not set up yet: BACKUP_ENCRYPTION_KEY and the file store must be set in the hosting settings."
                ne="अझै सेटअप भएको छैन: hosting setting मा BACKUP_ENCRYPTION_KEY र फाइल भण्डार राख्नुपर्छ।"
              />
            </p>
          ) : (
            <>
              <form action={backupNowAction} className="mt-3">
                <FormSubmitButton className="min-h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white">
                  <T en="Back up now" ne="अहिले backup बनाउने" />
                </FormSubmitButton>
              </form>
              {backups.stored.length ? (
                <ul className="mt-4 grid gap-2">
                  {backups.stored.map((backup) => (
                    <li key={backup.pathname} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-green-line px-4 py-2 text-sm">
                      <span className="text-brand-green-ink">
                        {formatAdminDate(backup.uploadedAt, { time: true })}
                        <span className="ml-2 text-xs text-brand-muted">{megabytes(backup.size)}</span>
                      </span>
                      <a
                        href={`/api/admin/backups/download?name=${encodeURIComponent(backup.pathname)}`}
                        className="inline-flex min-h-9 items-center rounded-full border border-brand-green px-4 text-xs font-black text-brand-green"
                      >
                        <T en="Download" ne="Download" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-brand-muted">
                  <T en="No stored backup yet." ne="अहिलेसम्म कुनै backup राखिएको छैन।" />
                </p>
              )}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}
