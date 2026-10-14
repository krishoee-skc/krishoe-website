import type { ReactNode } from "react";
import PageGroupStrip from "@/components/admin/PageGroupStrip";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageGroupStrip group="health" current="/admin/alerts" />
      {children}
    </>
  );
}
