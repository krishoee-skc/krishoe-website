import T from "@/components/T";
export default function PaymentInstructions() {
  return (
    <div className="rounded-lg border border-brand-green/20 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep"><T en="Payment note" ne="भुक्तानीबारे" /></p>
      <h3 className="mt-3 text-xl font-black text-brand-green-ink">
        <T en="Bank transfer / QR payment" ne="बैंक ट्रान्सफर / QR भुक्तानी" />
      </h3>
      <p className="mt-2 text-sm leading-7 text-gray-600">
        Use digital payment after KRISHOE confirms stock and delivery timing. Mention your order
        reference in the remarks.
      </p>
      <div className="mt-4 space-y-2 rounded-lg bg-brand-mist p-4 text-sm">
        <p>
          <span className="font-semibold">Bank:</span> Nabil Bank Ltd.
        </p>
        <p>
          <span className="font-semibold">Account Name:</span> KRISHOE Enterprises
        </p>
        <p>
          <span className="font-semibold">Account No:</span> 12345678901234
        </p>
        <p>
          <span className="font-semibold">Branch:</span> Narayangadh, Chitwan
        </p>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        <T en="After payment, send a screenshot on WhatsApp for faster confirmation." ne="तिरेपछि WhatsApp मा screenshot पठाउनुहोस् — छिटो पक्का हुन्छ।" />
      </p>
    </div>
  );
}
