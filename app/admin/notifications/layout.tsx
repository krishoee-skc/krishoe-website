import type { ReactNode } from "react";
import AdminPermissionLayout from "@/components/admin/AdminPermissionLayout";
import PageGroupStrip from "@/components/admin/PageGroupStrip";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AdminPermissionLayout permission="notifications:read">
      <PageGroupStrip group="health" current="/admin/notifications" />
      {children}
    </AdminPermissionLayout>
  );
}
