import type { Metadata } from "next";
import T from "@/components/T";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AccountLoginForm from "@/components/account/AccountLoginForm";
import PasswordResetRequestForm from "@/components/account/PasswordResetRequestForm";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { safeCustomerNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Customer Login | KRISHOE",
  description: "Sign in to your KRISHOE customer account.",
};

type AccountLoginPageProps = {
  searchParams?: Promise<{
    reset?: string;
    session?: string;
    verified?: string;
    next?: string;
  }>;
};

export default async function AccountLoginPage({ searchParams }: AccountLoginPageProps) {
  const user = await getCurrentCustomer();
  const resolvedSearchParams = await searchParams;
  const nextPath = safeCustomerNextPath(resolvedSearchParams?.next);

  if (user) {
    redirect(nextPath);
  }

  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="KRISHOE account" ne="KRISHOE खाता" />
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            <T en="Your saved checkout starts here." ne="तपाईंको विवरण यहीँ सुरक्षित रहन्छ।" />
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted">
            <T en="Sign in to keep delivery details ready for your next order request." ne="लगइन गर्नुहोस् — अर्को पटक ठेगाना फेरि लेख्नु पर्दैन।" />
          </p>
          {resolvedSearchParams?.reset === "success" ? (
            <p className="mt-6 rounded-lg bg-brand-green-mist p-4 text-sm font-semibold text-brand-green">
              <T en="Password reset complete. Please sign in with your new password." ne="पासवर्ड फेरियो। नयाँ पासवर्डले लगइन गर्नुहोस्।" />
            </p>
          ) : null}
          {resolvedSearchParams?.session === "ended" ? (
            <p className="mt-6 rounded-lg bg-brand-green-mist p-4 text-sm font-semibold text-brand-green">
              <T en="All customer sessions have been signed out. Please sign in again." ne="सबै यन्त्रबाट लगआउट भयो। फेरि लगइन गर्नुहोस्।" />
            </p>
          ) : null}
          {resolvedSearchParams?.verified === "success" ? (
            <p className="mt-6 rounded-lg bg-brand-green-mist p-4 text-sm font-semibold text-brand-green">
              <T en="Email verified. Please sign in to continue." ne="इमेल पक्का भयो। अब लगइन गर्नुहोस्।" />
            </p>
          ) : null}
          {resolvedSearchParams?.verified === "invalid" ? (
            <p className="mt-6 rounded-lg bg-brand-clay-mist p-4 text-sm font-semibold text-brand-clay">
              That email verification link is invalid or expired. Sign in and request a fresh link.
            </p>
          ) : null}
        </div>

        <div className="grid gap-6">
          <AccountLoginForm nextPath={nextPath} />
          <PasswordResetRequestForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}
