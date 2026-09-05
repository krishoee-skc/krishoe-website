import AdminNav from "./AdminNav";
import AdminCommandBar from "./AdminCommandBar";
import PasskeyInvite from "@/components/admin/PasskeyInvite";
import AdminMobileNav from "./AdminMobileNav";
import AdminQuickDock from "./AdminQuickDock";
import { SidebarProvider } from "@/components/admin/SidebarProvider";
import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-permissions";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }
  const adminRole = getSessionAdminRole(session);

  return (
    <SidebarProvider>
      <AdminNav
        adminRole={adminRole}
        adminName={session?.name}
        adminEmail={session?.email}
        branchId={session?.branchId}
      />
      <main className="admin-canvas min-w-0 overflow-x-clip bg-brand-paper-deep">
        <AdminMobileNav
          adminRole={adminRole}
          adminName={session?.name}
          adminEmail={session?.email}
          branchId={session?.branchId}
        />
        {/* The command bar — one search across every page, product, order,
            worker and bill, from the top of every admin screen. Read-only:
            it opens the same login-guarded search the search page uses. */}
        <div className="px-4 pt-4 sm:px-6">
          <AdminCommandBar />
        </div>
        {children}
        <AdminQuickDock adminRole={adminRole} />
        {/* Offered just after signing in, on the device being held. It
            hides itself when this account already has a passkey, and once
            declined it does not come back. */}
        <PasskeyInvite />
      </main>
    </SidebarProvider>
  );
}
