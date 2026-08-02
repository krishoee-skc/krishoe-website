import type { ReactNode } from "react";
import AdminPermissionLayout from "@/components/admin/AdminPermissionLayout";
export default function Layout({ children }: { children: ReactNode }) { return <AdminPermissionLayout permission="stock:read">{children}</AdminPermissionLayout>; }
