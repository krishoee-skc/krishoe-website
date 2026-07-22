import AdminNav from "./AdminNav";
import AdminMobileNav from "./AdminMobileNav";
import { getAdminSession } from "@/lib/admin-auth";
import { getSessionAdminRole } from "@/lib/admin-permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  const adminRole = getSessionAdminRole(session);

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[280px_1fr] print:block">
      <AdminNav
        adminRole={adminRole}
        adminName={session?.name}
        adminEmail={session?.email}
        branchId={session?.branchId}
      />
      <main className="flex flex-col bg-gray-50/40">
        <AdminMobileNav />
        {children}
      </main>
    </div>
  );
}
