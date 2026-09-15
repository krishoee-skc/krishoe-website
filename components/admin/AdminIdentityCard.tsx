import { type AdminRole } from "@/lib/admin-role-permissions";

/**
 * The identity card at the top of the admin menu — who is signed in. It used to
 * stack five lines (an "ADMIN ROLE" caption, the role, the name, the email, and
 * a long BRANCH-… code), which read as busy on a bar that is on screen all day.
 *
 * This keeps the two lines that matter — a monogram avatar beside the role with
 * an owner crown, then name · email on one muted line — and below them the
 * branch, named rather than coded. Fewer lines, one clear identity: the calm,
 * premium feel of a paid app.
 *
 * The branch used to be the raw id inside a closed <details>, which failed three
 * ways at once: it had to be opened to be read, `branch-2c320048-7f5c-…` names
 * nothing a person recognises, and it said nothing about the larger truth —
 * that every branch's rows are on screen regardless. The app connects as a role
 * with rolbypassrls, so Postgres skips the branch policies before reading them,
 * and a Manager signed into one branch is looking at every branch's stock,
 * wages and sales. For the Owner that is the design. For anyone else it is a
 * fact they had no way of seeing, so the chip says so in their own colour.
 *
 * Everything degrades gracefully — no name, no email, no branch each simply
 * drops its part, and an unknown branch name falls back to the id.
 */
export default function AdminIdentityCard({
  adminRole,
  adminName,
  adminEmail,
  branchId,
  branchName,
  branchType,
  seesAllBranches,
  branchCount,
}: {
  adminRole: AdminRole;
  adminName?: string;
  adminEmail?: string;
  branchId?: string;
  /** The branch's own name. Falls back to the id when settings has no row. */
  branchName?: string;
  /** Factory, Retail, Office… — only used to pick the symbol beside the name. */
  branchType?: string;
  /** Whether every branch's rows are on screen, not only this one's. */
  seesAllBranches?: boolean;
  /** How many branches that is, when it is all of them. */
  branchCount?: number;
}) {
  const isOwner = adminRole === "Owner";
  // The avatar letter: the name's initial, else the role's — never empty.
  const initial = (adminName?.trim()?.[0] ?? adminRole?.[0] ?? "•").toUpperCase();

  // The name if settings knows it, else the id. Never nothing: a branch that
  // was renamed or removed still has to identify itself, and a bare code the
  // owner can look up beats a blank line.
  const branchLabel = branchName || branchId;
  // A shoe factory and a shop are different places to stand, and the symbol
  // says which at a glance. Anything else takes the neutral mark.
  const branchMark = branchType === "Factory" ? "🏭" : branchType === "Retail" ? "🛒" : "🏢";

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

      {branchLabel ? (
        <div className="mt-2 border-t border-admin-border/60 pt-2 dark:border-admin-border-dark/60">
          <p className="flex items-center gap-1.5 text-xs font-black text-brand-green-ink dark:text-white">
            <span aria-hidden="true">{branchMark}</span>
            {/* break-all only matters in the fallback, where this is a long id. */}
            <span className="min-w-0 break-all">{branchLabel}</span>
          </p>

          {/* What is actually on screen. The app connects as a role that
              bypasses the branch policies, so every branch's rows are readable
              from here — for the Owner that is the design, for anyone else it
              is a fact they had no way of knowing. Same words, different tone. */}
          {seesAllBranches ? (
            <span
              className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black ${
                isOwner
                  ? "bg-brand-green-wash text-brand-green dark:text-admin-accent-light"
                  : "bg-brand-gold-wash text-brand-gold-ink dark:text-admin-accent-light"
              }`}
            >
              <span aria-hidden="true">{isOwner ? "👁" : "⚠"}</span>
              {branchCount && branchCount > 1
                ? `All ${branchCount} branches visible`
                : "All branches visible"}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
