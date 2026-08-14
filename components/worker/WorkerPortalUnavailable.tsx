import { logoutWorkerAction } from "@/app/worker/actions";

/**
 * Shown when a sign-in is genuine but carries no factory worker behind it.
 *
 * The wording used to send the reader off to fix a record in the HR module —
 * left over from when the portal read that module. The link the portal actually
 * needs is Settings → staff account → Factory worker, so the screen now names
 * that path, in Nepali, where the person reading it will be standing.
 */
export default function WorkerPortalUnavailable({ reason }: { reason: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-mist px-5 py-10">
      <div className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">
          Worker portal
        </p>
        <h1 className="mt-3 text-2xl font-black text-brand-green-ink">
          कामदार जोडिएको छैन
        </h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">{reason}</p>

        <div className="mt-5 rounded-lg bg-brand-mist p-4 text-left">
          <p className="text-sm font-black text-brand-green-ink">मालिकलाई देखाउनुहोस्:</p>
          <ol className="mt-2 grid gap-1.5 text-sm leading-6 text-brand-muted">
            <li>१. Admin → Settings खोल्नुहोस्</li>
            <li>२. यो खाता खोजेर Edit थिच्नुहोस्</li>
            <li>
              ३. <span className="font-bold text-brand-green-ink">Factory worker</span> मा
              कामदारको नाम छान्नुहोस्
            </li>
            <li>४. Save गरेपछि यहाँ काम र तलब देखिन्छ</li>
          </ol>
        </div>

        <p className="mt-4 text-xs leading-5 text-brand-muted">
          मालिक वा Admin खाताले यो portal चलाउन मिल्दैन — यो कामदारकै लागि हो।
        </p>

        <form action={logoutWorkerAction} className="mt-6">
          <button
            type="submit"
            className="h-11 rounded-full bg-brand-green px-6 text-sm font-bold text-white"
          >
            बाहिर निस्कने · Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
