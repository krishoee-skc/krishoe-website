"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setViewingBranchAction } from "@/app/admin/actions";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Look at one branch, or at all of them.
 *
 * Only rendered for somebody already entitled to every branch — for anybody
 * else there is nothing to choose between, and the action refuses them anyway.
 *
 * Choosing does not reshape a single query. Every admin request already carries
 * a branch id into Postgres, and this changes which one; the pages then filter
 * themselves. That is why a switch this small can scope the whole admin, and
 * why clearing it puts everything back exactly as it was.
 */
export default function BranchSwitch({
  branches,
  viewingBranchId,
}: {
  branches: Array<{ id: string; name: string; type?: string }>;
  /** The branch currently chosen, or "" while all of them are showing. */
  viewingBranchId: string;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  // Nothing to choose between with a single branch on file.
  if (branches.length < 2) return null;

  function choose(branchId: string) {
    startSaving(async () => {
      await setViewingBranchAction(branchId);
      // The layout was revalidated server-side; this re-renders what is open.
      router.refresh();
    });
  }

  return (
    <label className="block">
      <span className="sr-only">{text("Branch to show", "कुन branch हेर्ने")}</span>
      <select
        value={viewingBranchId}
        disabled={saving}
        onChange={(event) => choose(event.target.value)}
        className="h-9 w-full rounded-lg border border-admin-border bg-admin-surface px-2 text-xs font-bold text-brand-green-ink transition disabled:opacity-60 dark:border-admin-border-dark dark:bg-admin-surface-dark dark:text-white"
      >
        <option value="">👁 {text("All branches", "सबै branch")}</option>
        {branches.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.type === "Factory" ? "🏭 " : branch.type === "Retail" ? "🛒 " : "🏢 "}
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
