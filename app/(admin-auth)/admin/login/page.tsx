import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { getAdminSession } from "@/lib/admin-auth";
import { safeAdminNextPath } from "@/lib/safe-redirect";
import { isAdminBootstrapLoginAllowed } from "@/lib/admin-bootstrap-login";

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
  const session = await getAdminSession();

  if (session) {
    redirect(session.mustChangePassword ? "/admin/change-password" : nextPath);
  }

  const bootstrapLoginAllowed = await isAdminBootstrapLoginAllowed();

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-brand-green-ink px-5 py-16">
      {/* Decoration behind a form, at 35% opacity over a near-opaque gradient.
          It carried `priority`, which tells the browser to fetch it before the
          things people came for — on a phone that meant the sign-in fields
          waited on a 909KB photograph almost nobody can see. It loads when it
          gets there now, and `aria-hidden` keeps a screen reader from
          announcing a picture that carries no information. */}
      <Image
        src="/images/hero-banner.png"
        alt=""
        aria-hidden
        fill
        loading="lazy"
        sizes="100vw"
        className="object-cover opacity-35"
      />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,35,29,0.96),rgba(16,35,29,0.68))]" />
      <div className="relative z-10 flex w-full justify-center">
        <AdminLoginForm
          nextPath={nextPath}
          bootstrapLoginAllowed={bootstrapLoginAllowed}
        />
      </div>
    </main>
  );
}
