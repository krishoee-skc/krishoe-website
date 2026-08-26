import type { Metadata } from "next";
import Link from "next/link";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getCurrentCustomer } from "@/lib/customer-auth";
import {
  getCustomerEmailChoice,
  unsubscribeByToken,
} from "@/lib/customer-email-choice";
import { reportError } from "@/lib/report-error";
import EmailChoiceForm from "./EmailChoiceForm";

export const metadata: Metadata = {
  title: "Email choice | KRISHOE",
  // A page reached from a link in somebody's inbox has no business in a search
  // index, and a crawler following one would be pressing an unsubscribe button
  // on a stranger's behalf.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Where a customer stops the shop writing to them.
 *
 * Two ways in, on purpose. Signed in, the whole choice is here and can be set
 * either way. Arriving from a link at the bottom of an email — which is how
 * this is actually reached, on a phone, without logging in — the token in the
 * address turns the review invitations off and says so.
 *
 * The alternative to this page is the spam button, and that one silences the
 * shop for everybody, not just the person who pressed it.
 */
export default async function EmailChoicePage({
  searchParams,
}: {
  searchParams: Promise<{ stop?: string }>;
}) {
  const { stop } = await searchParams;

  // The token acts before anything else, because whoever followed the link
  // wants it done, not a login screen.
  let stopped: boolean | null = null;
  if (stop) {
    try {
      stopped = await unsubscribeByToken(stop);
    } catch (error) {
      reportError("stop review invitations from an email link", error);
      stopped = false;
    }
  }

  const user = await getCurrentCustomer();
  const choice = user ? await getCustomerEmailChoice(user.id).catch(() => null) : null;

  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-2xl px-5 py-12 md:px-8 md:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
          KRISHOE
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-4xl">
          <T en="Which letters you get" ne="कुन चिठी पाउने" />
        </h1>

        {stopped === true ? (
          <p className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
            <T
              en="Done — we will not ask you to review a pair again. The letter that confirms an order still comes, because that is your record of what you paid for."
              ne="भयो — अब जुत्ताको राय माग्ने चिठी आउँदैन। अर्डर पक्का भएको चिठी भने आइरहन्छ, किनभने त्यो तपाईंले तिरेको प्रमाण हो।"
            />
          </p>
        ) : null}

        {stopped === false ? (
          <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
            <T
              en="That link has expired. Sign in below and you can set it here instead."
              ne="त्यो लिङ्कको म्याद सकियो। तल साइन इन गर्नुभयो भने यहीँबाट मिलाउन सकिन्छ।"
            />
          </p>
        ) : null}

        {user && choice ? (
          <EmailChoiceForm
            orderUpdates={choice.orderUpdates}
            reviewInvites={choice.reviewInvites}
          />
        ) : (
          <div className="mt-6 rounded-2xl border border-brand-green-line bg-brand-paper p-6">
            <p className="text-sm leading-7 text-brand-muted">
              <T
                en="Sign in to change which letters you get."
                ne="कुन चिठी पाउने भन्ने मिलाउन साइन इन गर्नुहोस्।"
              />
            </p>
            <Link
              href="/account/login"
              className="mt-4 inline-flex h-12 items-center rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-green-ink"
            >
              <T en="Sign in" ne="साइन इन" />
            </Link>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}
