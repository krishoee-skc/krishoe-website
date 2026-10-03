import type { ReactNode } from "react";
import FactoryNav from "@/app/admin/factory/_components/factory-nav";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { workerInboxCounts } from "@/lib/worker-portal";

export const metadata = {
  title: "KRISHOE Factory Management",
  description: "Daily work tracking and payroll system for KRISHOE slippers factory",
};

export default async function FactoryLayout({ children }: { children: ReactNode }) {
  await requireAdminPermission("production:entry");
  const inbox = await workerInboxCounts().catch(() => ({ photos: 0, requests: 0 }));
  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,rgba(247,248,245,0.98),rgba(255,255,255,1)_22rem)]">
      <FactoryNav waiting={inbox.photos + inbox.requests} />
      <main className="mx-auto w-full max-w-[1600px]">{children}</main>
    </section>
  );
}
