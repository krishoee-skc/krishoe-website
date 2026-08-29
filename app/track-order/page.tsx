import type { Metadata } from "next";
import T from "@/components/T";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import TrackOrderForm from "@/components/TrackOrderForm";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Track your order | KRISHOE",
  description:
    "अर्डर नम्बर र मोबाइल हालेर आफ्नो KRISHOE अर्डर कहाँ पुग्यो हेर्नुहोस्। Track your KRISHOE order with your reference number and phone.",
  path: "/track-order",
});

/**
 * The page that answers "will my shoes actually come?".
 *
 * Nearly every order here is cash on delivery, which means the customer commits
 * before any money changes hands and has nothing to hold on to afterwards but a
 * reference number. Until now the only way to check was to telephone the shop —
 * a cost to them, a cost to the owner, and for a first-time buyer a reason not
 * to order at all.
 */
export default function TrackOrderPage() {
  return (
    <main className="bg-brand-mist">
      <Navbar />
      <section className="mx-auto max-w-7xl px-5 py-12 md:px-8 md:py-16">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
            KRISHOE
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-brand-green-ink md:text-5xl">
            <T en="Where has your order got to?" ne="अर्डर कहाँ पुग्यो?" />
          </h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-brand-muted">
            <T
              en="Put in the order number and your mobile number — where your pairs have got to shows straight away."
              ne="अर्डर नम्बर र आफ्नो मोबाइल नम्बर हाल्नुहोस् — तपाईंको जोडी कहाँ पुग्यो तुरुन्तै देखिन्छ।"
            />
          </p>
        </div>

        <TrackOrderForm />
      </section>
      <Footer />
    </main>
  );
}
