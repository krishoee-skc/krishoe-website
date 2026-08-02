import type { ReactNode } from "react";
import { requireAdminPermission, type AdminPermission } from "@/lib/admin-permissions";

export default async function AdminPermissionLayout({
  children,
  permission,
}: {
  children: ReactNode;
  permission: AdminPermission;
}) {
  await requireAdminPermission(permission);
  return <>{children}</>;
}
