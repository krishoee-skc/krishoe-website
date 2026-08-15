"use client";

import { adminWorkspaces, type AdminWorkspace } from "@/app/admin/nav-links";

/**
 * The one control that decides which half of the business the menu shows.
 *
 * Drawn the same way on the desktop sidebar, the phone sheet and the drawer, so
 * the switch is in the same place whichever device the owner picks up.
 */
export default function WorkspaceSwitch({
  workspace,
  onChoose,
  compact = false,
}: {
  workspace: AdminWorkspace;
  onChoose: (workspace: AdminWorkspace) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Workspace"
      className="grid grid-cols-2 gap-1 rounded-xl bg-admin-hover p-1 dark:bg-admin-hover-dark"
    >
      {adminWorkspaces.map((option) => {
        const isActive = workspace === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChoose(option.id)}
            aria-pressed={isActive}
            title={option.english}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-black transition ${
              isActive
                ? "bg-white text-admin-primary shadow-sm dark:bg-admin-sidebar-dark dark:text-admin-primary-light"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            <span aria-hidden>{option.emoji}</span>
            {!compact && <span>{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
