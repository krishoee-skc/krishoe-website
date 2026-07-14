import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AccountRegisterForm from "@/components/account/AccountRegisterForm";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { safeCustomerNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Create Customer Account | KRISHOE",
  description: "Create a KRISHOE customer account.",
};

type AccountRegisterPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function AccountRegisterPage({ searchParams }: AccountRegisterPageProps) {
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
            New KRISHOE customer
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-[#10231D] md:text-6xl">
            Create your account.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#5F6B66]">
            Keep your name, email, phone, and delivery address ready for checkout.
          </p>
        </div>

        <AccountRegisterForm nextPath={nextPath} />
      </section>
      <Footer />
    </main>
  );
}
