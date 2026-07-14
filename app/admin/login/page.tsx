import type { Metadata } from "next";
import Image from "next/image";
import AdminLoginForm from "@/components/AdminLoginForm";
import { safeAdminNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Admin Login | KRISHOE",
  description: "Secure KRISHOE admin login.",
};

type AdminLoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const resolvedSearchParams = await searchParams;
  const nextPath = safeAdminNextPath(resolvedSearchParams?.next);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#10231D] px-5 py-16">
      <Image
        src="/images/hero-banner.png"
        alt="KRISHOE premium footwear"
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,35,29,0.96),rgba(16,35,29,0.68))]" />
      <div className="relative z-10 flex w-full justify-center">
        <AdminLoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
