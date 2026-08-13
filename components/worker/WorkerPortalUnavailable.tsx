import { logoutWorkerAction } from "@/app/worker/actions";

export default function WorkerPortalUnavailable({ reason }: { reason: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-brand-mist px-5">
      <div className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-7 text-center shadow-sm">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-gold-deep">Worker portal</p>
        <h1 className="mt-3 text-2xl font-black text-brand-green-ink">HR setup required</h1>
        <p className="mt-3 text-sm leading-7 text-brand-muted">{reason}</p>
        <p className="mt-2 text-sm leading-7 text-brand-muted">
          Ask HR or an Owner to link this staff account to the correct HR employee record.
        </p>
        <form action={logoutWorkerAction} className="mt-6">
          <button type="submit" className="h-11 rounded-full bg-brand-green px-6 text-sm font-bold text-white">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
