import { type AdminRole } from "@/lib/admin-role-permissions";

/**
 * The identity card at the top of the admin menu — who is signed in. It used to
 * stack five lines (an "ADMIN ROLE" caption, the role, the name, the email, and
 * a long BRANCH-… code), which read as busy on a bar that is on screen all day.
 *
 * This keeps the two lines that matter — a monogram avatar beside the role with
 * an owner crown, then name · email on one muted line — and tucks the long
 * branch id inside a closed <details> the owner can open when they actually need
 * it. Fewer lines, one clear identity: the calm, premium feel of a paid app.
 *
 * The role, name, email and branch are the same values the menu always showed;
 * this only arranges them. Everything degrades gracefully — no name, no email,
 * no branch each simply drops its part.
 */
export default function AdminIdentityCard({
  adminRole,
  adminName,
  adminEmail,
  branchId,
}: {
  adminRole: AdminRole;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
}) {
  const isOwner = adminRole === "Owner";
  // The avatar letter: the name's initial, else the role's — never empty.
  const initial = (adminName?.trim()?.[0] ?? adminRole?.[0] ?? "•").toUpperCase();

  return (
    <div className="rounded-xl border border-admin-primary/20 bg-gradient-to-br from-admin-primary/5 to-admin-accent/5 p-3 dark:from-admin-primary/10 dark:to-admin-accent/10">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-admin-accent bg-gradient-to-br from-brand-green to-brand-green-ink font-display text-lg font-bold text-admin-accent-light"
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-base font-black leading-tight text-brand-green-ink dark:text-white">
            {adminRole}
            {isOwner ? (
              <span
                className="rounded-md bg-admin-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-admin-accent dark:text-admin-accent-light"
                title="Owner"
              >
                👑
              </span>
            ) : null}
          </p>
          {adminName || adminEmail ? (
            <p className="truncate text-xs text-brand-muted dark:text-white/60">
              {adminName ? <span className="font-semibold">{adminName}</span> : null}
              {adminName && adminEmail ? " · " : null}
              {adminEmail}
            </p>
          ) : null}
        </div>
      </div>

      {branchId ? (
        <details className="mt-2 border-t border-admin-border/60 pt-2 dark:border-admin-border-dark/60">
          <summary className="cursor-pointer list-none text-[11px] font-semibold text-brand-muted-soft transition hover:text-admin-accent">
            Branch ▾
          </summary>
          <p className="mt-1 break-all text-[11px] font-semibold uppercase tracking-wide text-admin-accent dark:text-admin-accent-light">
            {branchId}
          </p>
        </details>
      ) : null}
    </div>
  );
}
