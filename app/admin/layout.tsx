import AdminNav from "./AdminNav";
import AdminMobileNav from "./AdminMobileNav";
import AdminHeader from "./components/AdminHeader";
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
      <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr] print:block">
        <AdminNav
          adminRole={adminRole}
          adminName={session?.name}
          adminEmail={session?.email}
          branchId={session?.branchId}
        />
        <div className="flex flex-col">
          <AdminHeader
            adminName={session?.name}
            adminEmail={session?.email}
            adminRole={adminRole}
            onMenuToggle={() => {}}
          />
          <main className="admin-canvas flex-1 min-w-0 overflow-x-clip bg-gray-50 dark:bg-gray-900">
            <AdminMobileNav adminRole={adminRole} />
            {children}
            <AdminQuickDock adminRole={adminRole} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
