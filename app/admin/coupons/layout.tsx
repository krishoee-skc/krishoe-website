import type { ReactNode } from "react";
import PageGroupStrip from "@/components/admin/PageGroupStrip";

// The page checks who may open it; this only puts the row on top (owner,
// 2026-10-20, sample ख: the page left the menu).
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageGroupStrip group="money" current="/admin/coupons" />
      {children}
    </>
  );
}
