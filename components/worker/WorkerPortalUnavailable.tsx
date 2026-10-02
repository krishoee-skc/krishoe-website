import { logoutWorkerAction } from "@/app/worker/actions";

/**
 * Shown when a sign-in is genuine but carries no factory worker behind it.
 *
 * The wording used to send the reader off to fix a record in the HR module —
 * left over from when the portal read that module. The link the portal actually
 * needs is Settings → staff account → Factory worker, so the screen now names
 * that path, in Nepali, where the person reading it will be standing.
 */
export default function WorkerPortalUnavailable({ reason, closed = false }: { reason: string; closed?: boolean }) {
  // A worker who has left: the account is closed, and that is all there is to
  // say — their record is safe, and the owner is the one to ask.
  if (closed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[linear-gradient(180deg,#0b2e22,#123f30)] px-5 py-10 text-white">
        <div className="grid w-full max-w-md justify-items-center gap-4 text-center">
          <span aria-hidden="true" className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-3xl">🔒</span>
          <h1 className="text-2xl font-black text-white">तपाईंको खाता बन्द छ</h1>
          <p className="text-base leading-7 text-white/80">
            KRISHOE मा तपाईंको काम सकिएकाले यो खाता बन्द गरिएको छ। तपाईंको पुरानो हिसाब र तलब सुरक्षित छ।
          </p>
          <p className="text-sm text-white/70">Your account is closed. Your past work and pay are kept. Ask the owner if you need anything.</p>
          <form action={logoutWorkerAction}>
            <button type="submit" className="min-h-12 rounded-2xl bg-brand-gold-bright px-6 text-base font-black text-brand-green-ink">
              बाहिर निस्कने · Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-mist px-5 py-10">
      <div className="w-full max-w-lg rounded-lg border border-black/10 bg-brand-paper p-7 text-center shadow-sm">
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
