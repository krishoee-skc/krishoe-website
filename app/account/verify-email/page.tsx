import type { Metadata } from "next";
import T from "@/components/T";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { confirmEmailVerificationAction } from "@/app/account/actions";
import { getEmailVerificationToken } from "@/lib/email-verification-store";

export const metadata: Metadata = {
  title: "Verify Email | KRISHOE",
  description: "Verify your KRISHOE customer account email.",
};

type VerifyEmailPageProps = {
  searchParams?: Promise<{
    token?: string;
  }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams?.token ?? "";
  const storedToken = token ? await getEmailVerificationToken(token) : null;
  const validToken =
    storedToken && new Date(storedToken.expiresAt) >= new Date() ? storedToken : null;

  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-2xl px-5 py-16 md:px-8">
        <div className="rounded-lg border border-black/10 bg-white p-6 text-center shadow-[0_24px_70px_rgba(16,35,29,0.08)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="KRISHOE account" ne="KRISHOE खाता" />
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink">
            <T en="Verify your email." ne="इमेल पक्का गर्नुहोस्।" />
          </h1>

          {validToken ? (
            <>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-brand-muted">
                Confirm that {validToken.email} belongs to you. This keeps private order
                details protected.
              </p>
              <form action={confirmEmailVerificationAction} className="mt-7">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
                >
                  <T en="Verify email" ne="इमेल पक्का गर्ने" />
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-brand-muted">
                This verification link is invalid or has expired. Sign in and send a fresh
                verification link from your account page.
              </p>
              <Link
                href="/account/login"
                className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-gold-bright hover:text-brand-green-ink"
              >
                <T en="Go to login" ne="लगइनमा जाने" />
              </Link>
            </>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
