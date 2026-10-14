import type { ReactNode } from "react";
import AdminPermissionLayout from "@/components/admin/AdminPermissionLayout";
import PageGroupStrip from "@/components/admin/PageGroupStrip";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AdminPermissionLayout permission="devices:read">
      <PageGroupStrip group="security" current="/admin/devices" />
      {children}
    </AdminPermissionLayout>
  );
}
