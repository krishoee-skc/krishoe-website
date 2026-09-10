import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CheckoutClient from "@/components/CheckoutClient";
import { CheckIcon } from "@/components/Icons";
import T from "@/components/T";
import { getCurrentCustomer } from "@/lib/customer-auth";
import { getAdminSettings } from "@/lib/admin-settings";
import { reportError } from "@/lib/report-error";
import type { BankDetails } from "@/components/PaymentInstructions";

const NO_BANK: BankDetails = {
  bankName: "",
  bankAccountName: "",
  bankAccountNumber: "",
  bankBranch: "",
};

/**
 * The owner's bank details for the transfer panel.
 *
 * A settings hiccup must not take checkout down — the rest of the page still
 * takes the order, and Cash on delivery does not need a bank account. Falling
 * back to empty hides the panel, which is the honest failure: better to show no
 * account than a wrong one.
 */
async function loadBankDetails(): Promise<BankDetails> {
  try {
    const { company } = await getAdminSettings();
    return {
      bankName: company.bankName,
      bankAccountName: company.bankAccountName,
      bankAccountNumber: company.bankAccountNumber,
      bankBranch: company.bankBranch,
    };
  } catch (error) {
    reportError("load checkout bank details", error);
    return NO_BANK;
  }
}

export const metadata: Metadata = {
  title: "Checkout | KRISHOE",
  description: "Complete a KRISHOE order request with delivery and payment preferences.",
};

export default async function CheckoutPage() {
  const [user, bank] = await Promise.all([getCurrentCustomer(), loadBankDetails()]);
  const trustItems = [
    { en: "Stock confirmed before payment", ne: "भुक्तानीअघि स्टक पक्का" },
    { en: "Cash on delivery available", ne: "सामान बुझ्दा नगद सुविधा" },
    { en: "Order status after request", ne: "अनुरोधपछि अर्डरको अवस्था" },
  ];

  return (
    <main className="bg-brand-mist">
      <Navbar isLoggedIn={Boolean(user)} />
      <section className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            <T en="Premium checkout" ne="प्रिमियम चेकआउट" />
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-6xl">
            <T en="Confirm your order." ne="आफ्नो अर्डर पक्का गर्नुहोस्।" />
          </h1>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {trustItems.map((item) => (
              <div
                key={item.en}
                className="flex min-h-12 items-center gap-2 rounded-full border border-brand-green/20 bg-brand-paper px-4 text-sm font-bold text-brand-green-ink"
              >
                <CheckIcon className="h-4 w-4 shrink-0 text-brand-green" />
                <T en={item.en} ne={item.ne} />
              </div>
            ))}
          </div>
        </div>
        <CheckoutClient user={user} bank={bank} />
      </section>
      <Footer />
    </main>
  );
}
