"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { XIcon } from "@/components/Icons";
import WorkspaceSwitch from "@/app/admin/WorkspaceSwitch";
import { useAdminWorkspace } from "@/app/admin/useAdminWorkspace";
import { type AdminRole } from "@/lib/admin-role-permissions";

interface AdminDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  adminRole: AdminRole;
}

export default function AdminDrawer({ isOpen, onClose, adminRole }: AdminDrawerProps) {
  const pathname = usePathname();
  const { workspace, chooseWorkspace, groups } = useAdminWorkspace(adminRole, pathname);

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 z-40 h-screen w-64 bg-admin-sidebar dark:bg-admin-sidebar-dark border-r border-admin-border dark:border-admin-border-dark transform transition-transform duration-300 lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-admin-border px-4 dark:border-admin-border-dark">
            <Link href="/admin" className="flex items-center gap-2" onClick={onClose}>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-admin-primary to-admin-accent text-white font-bold text-sm">
                K
              </div>
              <span className="font-bold text-gray-900 dark:text-white">KRISHOE</span>
            </Link>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-admin-hover dark:hover:bg-admin-hover-dark"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-auto p-4">
            <WorkspaceSwitch workspace={workspace} onChoose={chooseWorkspace} />
            <div className="mt-4 grid items-start gap-4 font-medium">
              {groups.map((group) => (
                <div key={group.id} className="grid gap-1">
                  <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
                    {group.title}
                  </p>
                  {group.links.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={`${group.id}-${href}`}
                        href={href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-md px-3 py-2 transition-all duration-200 ${
                          isActive
                            ? "bg-admin-primary/10 text-admin-primary dark:bg-admin-primary/20 dark:text-admin-primary-light border-l-4 border-admin-primary"
                            : "text-gray-600 hover:text-gray-900 hover:bg-admin-hover dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-admin-hover-dark"
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="text-sm">{label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
