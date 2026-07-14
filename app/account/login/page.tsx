import type { Metadata } from "next";
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
    <main className="bg-[#F5F7F4]">
      <Navbar />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-16 md:px-8 lg:grid-cols-[minmax(0,520px)_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#B98A2E]">
            KRISHOE account
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-6xl">
            Your saved checkout starts here.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#5F6B66]">
            Sign in to keep delivery details ready for your next order request.
          </p>
          {resolvedSearchParams?.reset === "success" ? (
            <p className="mt-6 rounded-lg bg-[#E9F2EE] p-4 text-sm font-semibold text-[#0B4D3B]">
              Password reset complete. Please sign in with your new password.
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
