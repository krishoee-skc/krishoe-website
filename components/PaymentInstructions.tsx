export default function PaymentInstructions() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6">
      <h3 className="font-bold text-gray-800">Bank Transfer / QR Payment</h3>
      <p className="mt-2 text-sm text-gray-600">
        Please transfer the total amount to the following bank account and mention your Order ID in
        the remarks.
      </p>
      <div className="mt-4 space-y-2 rounded-lg bg-white p-4 text-sm">
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
        After payment, please send a screenshot to our WhatsApp number for faster confirmation.
      </p>
    </div>
  );
}