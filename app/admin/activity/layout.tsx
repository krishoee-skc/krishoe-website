import type { ReactNode } from "react";
import AdminPermissionLayout from "@/components/admin/AdminPermissionLayout";
import PageGroupStrip from "@/components/admin/PageGroupStrip";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <AdminPermissionLayout permission="activity:read">
      <PageGroupStrip group="health" current="/admin/activity" />
      {children}
    </AdminPermissionLayout>
  );
}
