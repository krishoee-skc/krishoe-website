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
  branchSwitch,
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
  /** The branch chooser, passed in so this stays a server component. */
  branchSwitch?: React.ReactNode;
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
    // One line (owner, 2026-09-29): the card stacked role, name · email, the
    // branch, a chooser and a scope chip — about 290px on the owner's screen —
    // and squeezed the page list into a small scrolling box showing five of
    // eleven pages. The name and email sit in the tooltip; the branch is the
    // chooser itself, or its name when there is nothing to choose.
    <div
      title={[adminName, adminEmail].filter(Boolean).join(" · ") || undefined}
      className="rounded-xl border border-admin-primary/20 bg-gradient-to-br from-admin-primary/5 to-admin-accent/5 px-2.5 py-2 dark:from-admin-primary/10 dark:to-admin-accent/10"
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-admin-accent bg-gradient-to-br from-brand-green to-brand-green-ink font-display text-base font-bold text-admin-accent-light"
        >
          {initial}
        </span>
        <p className="flex min-w-0 flex-1 items-center gap-1 truncate text-base font-black leading-tight text-brand-green-ink dark:text-white">
          <span className="truncate">{adminRole}</span>
          {isOwner ? (
            <span aria-hidden="true" className="shrink-0 text-sm" title="Owner">
              👑
            </span>
          ) : null}
          {adminName || adminEmail ? (
            <span className="sr-only">{[adminName, adminEmail].filter(Boolean).join(" · ")}</span>
          ) : null}
        </p>

        {/* The chooser, for those who may narrow to one branch; it names the
            branch on screen (or "all"), so the session's own branch is not
            printed beside it to contradict it. */}
        {branchSwitch ? (
          <div className="min-w-0 max-w-[60%] shrink">{branchSwitch}</div>
        ) : branchLabel ? (
          <p className="flex min-w-0 max-w-[60%] items-start gap-1 text-sm font-black leading-snug text-brand-green-ink dark:text-white">
            {/* shrink-0, or flex squeezes the symbol before it wraps the name
                beside it, and the mark reads as a smudge. */}
            <span aria-hidden="true" className="shrink-0">
              {branchMark}
            </span>
            {/* break-words, not break-all: "narayangadh kamalnagar" must wrap
                between words; only a long bare id is split. */}
            <span className="min-w-0 break-words">{branchLabel}</span>
          </p>
        ) : null}
      </div>

      {/* What is actually on screen. The app connects as a role that bypasses
          the branch policies, so every branch's rows are readable from here.
          For the Owner that is the design, and the chooser already says "all";
          for anyone else it is a fact they had no way of knowing, so they are
          told, in the warning colour. */}
      {seesAllBranches && !isOwner ? (
        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-gold-wash px-2 py-0.5 text-xs font-black text-brand-gold-ink dark:text-admin-accent-light">
          <span aria-hidden="true">⚠</span>
          {branchCount && branchCount > 1
            ? `All ${branchCount} branches visible`
            : "All branches visible"}
        </span>
      ) : null}
    </div>
  );
}
