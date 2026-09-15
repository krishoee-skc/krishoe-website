import AdminNav from "./AdminNav";
import AdminCommandBar from "./AdminCommandBar";
import PasskeyInvite from "@/components/admin/PasskeyInvite";
import AdminMobileNav from "./AdminMobileNav";
import AdminQuickDock from "./AdminQuickDock";
import { SidebarProvider } from "@/components/admin/SidebarProvider";
import { ToastProvider } from "@/components/admin/ToastProvider";
import LanguageSwitch from "@/components/LanguageSwitch";
import { getAdminSession, readViewingBranchId } from "@/lib/admin-auth";
import BranchSwitch from "@/components/admin/BranchSwitch";
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

  // Whether every branch is on screen, decided the same two ways the database
  // access is: the legacy environment-password login carries no staff identity,
  // and the Owner is exempt by the rule in lib/admin-auth.ts. Read from
  // allBranchAdminRole rather than spelled again, so the screen cannot keep
  // saying "Owner" on the day that rule changes.
  const canSeeAllBranches = !session.staffId || adminRole === allBranchAdminRole;

  // The branch chosen from the switcher, or "" while all of them show. Read
  // from the same helper getAdminSession used, so the menu cannot disagree with
  // the rows on the page, and ignored for anyone who may not choose at all.
  const viewingBranchId = canSeeAllBranches ? await readViewingBranchId() : "";

  // The chip says "all branches" only when all of them really are on screen —
  // entitled to see them, and not currently narrowed to one.
  const seesAllBranches = canSeeAllBranches && !viewingBranchId;

  // The branch the menu names: the chosen one while narrowed, otherwise the one
  // the account is posted to. This is the branch whose rows the page is showing.
  const branch = settings?.branches.find(
    (row) => row.id === (viewingBranchId || session.branchId),
  );

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
        branchSwitch={
          canSeeAllBranches && settings ? (
            <BranchSwitch branches={settings.branches} viewingBranchId={viewingBranchId} />
          ) : null
        }
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
          branchSwitch={
            canSeeAllBranches && settings ? (
              <BranchSwitch branches={settings.branches} viewingBranchId={viewingBranchId} />
            ) : null
          }
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
