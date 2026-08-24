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
      <div className="relative z-10 flex w-full flex-col items-center gap-6">
        {/* The full lockup, and this is the one screen in the app with room for
            it. The artwork is set on black, which sits inside a deep-green page
            without a seam; anywhere the ground is white it would print as a
            slab, so the crest alone goes there instead.

            priority, unlike the photograph behind it: this is the first thing
            the owner sees every morning, and it is 150KB against that image's
            909KB. */}
        <Image
          src="/images/logo-full.webp"
          alt="KRISHOE"
          width={1200}
          height={1061}
          preload
          sizes="(max-width: 640px) 220px, 260px"
          className="h-auto w-[220px] sm:w-[260px]"
        />
        <AdminLoginForm
          nextPath={nextPath}
          bootstrapLoginAllowed={bootstrapLoginAllowed}
        />
      </div>
    </main>
  );
}
