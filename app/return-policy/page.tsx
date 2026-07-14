import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Return Policy | KRISHOE",
};

export default function ReturnPolicyPage() {
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-4xl px-5 py-16 md:px-8">
        <div className="prose lg:prose-lg">
          <h1>Return Policy</h1>
          <p>
            We want you to be completely satisfied with your purchase. If you are not happy with your
            product, you may return it within 7 days of delivery for a full refund or exchange,
            provided the item is in its original, unused condition with all tags and packaging
            intact.
          </p>
          <h2>How to Initiate a Return</h2>
          <p>
            To initiate a return, please contact our customer service team at{" "}
            <a href="mailto:info@krishoe.com">info@krishoe.com</a> with your order reference number
            and the reason for the return. Our team will guide you through the process.
          </p>
          <h2>Conditions</h2>
          <ul>
            <li>Items must be returned within 7 days of receipt.</li>
            <li>Items must be unworn, unwashed, and in original condition.</li>
            <li>Original tags and packaging must be included.</li>
            <li>Return shipping costs are the responsibility of the customer unless the item is defective.</li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
