import T from "@/components/T";

export type BankDetails = {
  bankName: string;
  bankAccountName: string;
  bankAccountNumber: string;
  bankBranch: string;
};

/**
 * Where a customer sends a bank transfer or QR payment.
 *
 * This panel used to carry `Account No: 12345678901234` — an invented number,
 * hard-coded, shown to every shopper at the moment they were deciding whether
 * to send real money. Nothing else on the page could earn back the trust that
 * one line spent.
 *
 * The details now come from the owner's Settings. The account number is what
 * makes the panel useful, so an empty one renders nothing at all: a shop that
 * has not set up transfers should say nothing, not show half an account. The
 * other lines are optional and each is dropped when blank, so a partly filled
 * form never prints a dangling "Branch:" label.
 */
export default function PaymentInstructions({ bank }: { bank: BankDetails }) {
  if (!bank.bankAccountNumber.trim()) return null;

  const lines = [
    { en: "Bank", ne: "बैंक", value: bank.bankName },
    { en: "Account Name", ne: "खाताको नाम", value: bank.bankAccountName },
    { en: "Account No", ne: "खाता नम्बर", value: bank.bankAccountNumber },
    { en: "Branch", ne: "शाखा", value: bank.bankBranch },
  ].filter((line) => line.value.trim());

  return (
    <div className="rounded-lg border border-brand-green/20 bg-brand-paper p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep">
        <T en="Payment note" ne="भुक्तानीबारे" />
      </p>
      <h3 className="mt-3 text-xl font-black text-brand-green-ink">
        <T en="Bank transfer / QR payment" ne="बैंक ट्रान्सफर / QR भुक्तानी" />
      </h3>
      <p className="mt-2 text-sm leading-7 text-gray-600">
        <T
          en="Use digital payment after KRISHOE confirms stock and delivery timing. Mention your order reference in the remarks."
          ne="स्टक र डेलिभरी पक्का भएपछि मात्र डिजिटल भुक्तानी गर्नुहोस्। रिमार्क्समा आफ्नो अर्डर नम्बर लेख्नुहोस्।"
        />
      </p>
      <dl className="mt-4 space-y-2 rounded-lg bg-brand-mist p-4 text-sm">
        {lines.map((line) => (
          <div key={line.en} className="flex flex-wrap gap-x-2">
            <dt className="font-semibold">
              <T en={`${line.en}:`} ne={`${line.ne}:`} />
            </dt>
            <dd className="break-all">{line.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-gray-500">
        <T
          en="After payment, send a screenshot on WhatsApp for faster confirmation."
          ne="तिरेपछि WhatsApp मा screenshot पठाउनुहोस् — छिटो पक्का हुन्छ।"
        />
      </p>
    </div>
  );
}
