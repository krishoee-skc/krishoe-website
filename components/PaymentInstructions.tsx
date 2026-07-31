export default function PaymentInstructions() {
  return (
    <div className="rounded-lg border border-brand-green/20 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">Payment note</p>
      <h3 className="mt-3 text-xl font-black text-brand-green-ink">Bank transfer / QR payment</h3>
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
        After payment, send a screenshot on WhatsApp for faster confirmation.
      </p>
    </div>
  );
}
