import AdminNav from "./AdminNav";
import AdminCommandBar from "./AdminCommandBar";
import PasskeyInvite from "@/components/admin/PasskeyInvite";
import AdminMobileNav from "./AdminMobileNav";
import AdminQuickDock from "./AdminQuickDock";
import { SidebarProvider } from "@/components/admin/SidebarProvider";
import { ToastProvider } from "@/components/admin/ToastProvider";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import { allBranchAdminRole } from "@/lib/admin-branch-context";
import { getAdminSettings } from "@/lib/admin-settings";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  const adminRole = getSessionAdminRole(session);

  // The branch's name for the menu. Never let this break the whole admin: a
  // settings read that fails should cost the label, not the page, so the card
  // falls back to the id it was already showing.
  const settings = await getAdminSettings().catch(() => null);
  const branch = settings?.branches.find((row) => row.id === session.branchId);

  // Whether every branch is on screen, decided the same two ways the database
  // access is: the legacy environment-password login carries no staff identity,
  // and the Owner is exempt by the rule in lib/admin-auth.ts. Read from
  // allBranchAdminRole rather than spelled again, so the screen cannot keep
  // saying "Owner" on the day that rule changes.
  const seesAllBranches = !session.staffId || adminRole === allBranchAdminRole;

  return (
    <ToastProvider>
    <SidebarProvider>
      <AdminNav
        adminRole={adminRole}
        adminName={session?.name}
        adminEmail={session?.email}
        branchId={session?.branchId}
        branchName={branch?.name}
        branchType={branch?.type}
        seesAllBranches={seesAllBranches}
        branchCount={settings?.branches.length}
      />
      <main className="admin-canvas min-w-0 overflow-x-clip bg-brand-paper-deep">
        <AdminMobileNav
          adminRole={adminRole}
          adminName={session?.name}
          adminEmail={session?.email}
          branchId={session?.branchId}
          branchName={branch?.name}
          branchType={branch?.type}
          seesAllBranches={seesAllBranches}
          branchCount={settings?.branches.length}
        />
        {/* The top row: the command bar — one search across every page,
            product, order, worker and bill — with the language toggle beside
            it, so the shop's two words sit up top by the search instead of
            crowding the foot of the menu. The px matches the page below so the
            search's left edge lines up with the dashboard cards. Read-only: the
            bar opens the same login-guarded search the search page uses. */}
        <div className="flex items-center gap-3 px-4 pt-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <AdminCommandBar />
          </div>
          <LanguageSwitch />
        </div>
        {children}
        <AdminQuickDock adminRole={adminRole} />
        {/* Offered just after signing in, on the device being held. It
            hides itself when this account already has a passkey, and once
            declined it does not come back. */}
        <PasskeyInvite />
      </main>
    </SidebarProvider>
    </ToastProvider>
  );
}
