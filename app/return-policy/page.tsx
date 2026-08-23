import Navbar from "@/components/Navbar";
import T from "@/components/T";
import Footer from "@/components/Footer";
import { businessContact } from "@/lib/seo";

export const metadata = {
  title: "Return Policy | KRISHOE",
};

export default function ReturnPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 py-16 md:px-8">
        <div className="prose lg:prose-lg">
          <h1>
            <T en="Return Policy" ne="फिर्ता नीति" />
          </h1>
          <p>
            <T
              en="We want you to be completely satisfied with your purchase. If you are not happy with your product, you may return it within 7 days of delivery for a full refund or exchange, provided the item is in its original, unused condition with all tags and packaging intact."
              ne="जुत्ता मन परेन भने चिन्ता नलिनुहोस्। सामान पाएको ७ दिनभित्र फिर्ता वा साट्न मिल्छ — नलगाएको, नधोएको, ट्याग र बाकस जस्ताको तस्तै भएमा।"
            />
          </p>
          <h2>
            <T en="How to Initiate a Return" ne="फिर्ता कसरी गर्ने" />
          </h2>
          <p>
            <T en="To initiate a return, please contact our customer service team at" ne="फिर्ता गर्न हामीलाई सम्पर्क गर्नुहोस् —" />{" "}
            {/* The address here was info@krishoe.com, on a domain nobody has
                registered. A customer asking to exchange a pair was writing to
                nowhere and heard nothing back — the worst possible moment to be
                unreachable. The phone is offered first because that is how this
                shop's customers actually get hold of it. */}
            <a href={`tel:${businessContact.phoneTel}`}>{businessContact.phoneDisplay}</a> or{" "}
            <a href={`mailto:${businessContact.email}`}>{businessContact.email}</a> with your order
            <T
              en="with your order reference number and the reason for the return. Our team will guide you through the process."
              ne="— अर्डर नम्बर र किन फिर्ता गर्न खोज्नुभएको हो भन्नुहोस्। बाँकी हामी मिलाउँछौँ।"
            />
          </p>
          <h2>
            <T en="Conditions" ne="सर्तहरू" />
          </h2>
          <ul>
            <li>
              <T en="Items must be returned within 7 days of receipt." ne="सामान पाएको ७ दिनभित्र फिर्ता गर्नुपर्छ।" />
            </li>
            <li>
              <T en="Items must be unworn, unwashed, and in original condition." ne="नलगाएको, नधोएको, जस्ताको तस्तै हुनुपर्छ।" />
            </li>
            <li>
              <T en="Original tags and packaging must be included." ne="ट्याग र बाकस पनि सँगै हुनुपर्छ।" />
            </li>
            <li>
              <T
                en="Return shipping costs are the responsibility of the customer unless the item is defective."
                ne="फिर्ता पठाउने भाडा ग्राहकले नै बेहोर्नुपर्छ — तर सामान बिग्रेको भए हामीले।"
              />
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
