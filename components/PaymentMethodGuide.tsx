"use client";

import { useState } from "react";
import { ChevronDownIcon, CheckIcon } from "@/components/Icons";

interface PaymentMethodGuideProps {
  selectedPayment: string;
  orderTotal: string;
  customerPhone: string;
}

type PaymentMethodType =
  | "Cash on delivery"
  | "eSewa / Khalti link after stock confirmation"
  | "QR / bank transfer confirmation"
  | "Store pickup payment";

interface PaymentMethod {
  id: PaymentMethodType;
  title: string;
  titleNepali: string;
  icon: string;
  description: string;
  descriptionNepali: string;
  steps: {
    step: string;
    stepNepali: string;
    details: string;
    detailsNepali: string;
  }[];
  benefits: string[];
  benefitsNepali: string[];
  processingTime: string;
  processingTimeNepali: string;
  note: string;
  noteNepali: string;
}

const paymentMethods: Record<PaymentMethodType, PaymentMethod> = {
  "Cash on delivery": {
    id: "Cash on delivery",
    title: "Cash on Delivery (COD)",
    titleNepali: "डिलिभरीमा नगद",
    icon: "💵",
    description: "Pay when your order arrives at your doorstep",
    descriptionNepali: "पैकेज आएमा नगद दिनुस्",
    steps: [
      {
        step: "1. Confirm Order",
        stepNepali: "१. अर्डर confirm गर्ने",
        details: "Click 'Submit order request' - no payment needed now",
        detailsNepali: "Submit अर्डर भर्ने - अहिले पैसा नलाग्ने",
      },
      {
        step: "2. Get Confirmation",
        stepNepali: "२. Confirmation पाउ",
        details: "KRISHOE confirms stock & delivery within 2 hours",
        detailsNepali: "KRISHOE 2 घन्टामा stock र delivery confirm गर्छ",
      },
      {
        step: "3. Receive Package",
        stepNepali: "३. पैकेज पाउ",
        details: "Delivery agent brings your order to your address",
        detailsNepali: "Delivery agent आपको पैकेज घरमा लैजान्छ",
      },
      {
        step: "4. Pay & Receive",
        stepNepali: "४. पैसा दिएर पाउ",
        details: "Count pairs, verify condition, then pay the amount",
        detailsNepali: "जोडी गिन्ने, चेक गर्ने, पछि पैसा दिने",
      },
    ],
    benefits: [
      "No online payment risk",
      "Inspect before paying",
      "Easy for COD areas",
      "No commission charges",
    ],
    benefitsNepali: [
      "Online payment को risk नेह",
      "Payment गर्न अगाडि check गर्न सकिने",
      "COD areas मा सजिलो",
      "कुनै commission नलाग्ने",
    ],
    processingTime: "2-3 working days",
    processingTimeNepali: "२-३ काम गर्ने दिन",
    note: "Delivered in Kathmandu Valley and select courier locations",
    noteNepali: "काठमाडौं र select courier locations मा delivery",
  },
  "eSewa / Khalti link after stock confirmation": {
    id: "eSewa / Khalti link after stock confirmation",
    title: "Digital Payment (eSewa / Khalti)",
    titleNepali: "डिजिटल पेमेन्ट (eSewa / Khalti)",
    icon: "📱",
    description: "Secure online payment via eSewa or Khalti wallet",
    descriptionNepali: "eSewa वा Khalti को माध्यमबाट सुरक्षित payment",
    steps: [
      {
        step: "1. Submit Order",
        stepNepali: "१. अर्डर भर्ने",
        details: "Fill checkout form with delivery address",
        detailsNepali: "Checkout फर्म भर्ने र address लिखाउ",
      },
      {
        step: "2. Wait for Confirmation",
        stepNepali: "२. Confirmation को लागि wait गर्ने",
        details: "KRISHOE confirms stock within 2 hours via SMS",
        detailsNepali: "KRISHOE 2 घन्टामा SMS माध्यमबाट confirm गर्छ",
      },
      {
        step: "3. Receive Payment Link",
        stepNepali: "३. Payment link पाउ",
        details: "Get secure payment link via SMS/Email",
        detailsNepali: "SMS/Email मा payment link पाउ",
      },
      {
        step: "4. Pay Online",
        stepNepali: "४. Online payment गर्ने",
        details: "Click link, choose eSewa/Khalti, enter PIN",
        detailsNepali: "Link click गर्ने, eSewa/Khalti select गर्ने",
      },
      {
        step: "5. Get Delivery",
        stepNepali: "५. डिलिभरी पाउ",
        details: "Payment confirmed, package dispatches same day",
        detailsNepali: "Payment भएपछि उही दिन dispatch हुन्छ",
      },
    ],
    benefits: [
      "Fast checkout (payment after confirmation)",
      "Secure & encrypted",
      "Instant payment confirmation",
      "No cash handling risk",
      "Digital receipt",
    ],
    benefitsNepali: [
      "तेजो checkout (confirmation पछि payment)",
      "सुरक्षित र encrypted",
      "तुरुन्त payment confirmation",
      "नगद को risk नेह",
      "Digital receipt",
    ],
    processingTime: "1-2 working days",
    processingTimeNepali: "१-२ काम गर्ने दिन",
    note: "Fastest delivery option. Available nationwide via eSewa/Khalti",
    noteNepali: "सबै भन्दा छिटो delivery। पूरा देशमा उपलब्ध",
  },
  "QR / bank transfer confirmation": {
    id: "QR / bank transfer confirmation",
    title: "Bank Transfer",
    titleNepali: "Bank Transfer",
    icon: "🏦",
    description: "Transfer to KRISHOE bank account via mobile banking or QR",
    descriptionNepali: "Bank account मा transfer गर्ने (QR वा direct)",
    steps: [
      {
        step: "1. Submit Order",
        stepNepali: "१. अर्डर भर्ने",
        details: "Fill checkout form with delivery details",
        detailsNepali: "Checkout फर्म भर्ने",
      },
      {
        step: "2. Get Bank Details",
        stepNepali: "२. Bank details पाउ",
        details: "Receive bank account number & QR code via SMS",
        detailsNepali: "SMS मा bank account र QR code पाउ",
      },
      {
        step: "3. Make Transfer",
        stepNepali: "३. Transfer गर्ने",
        details: "Use mobile banking to scan QR or enter account number",
        detailsNepali: "Mobile banking को माध्यमबाट transfer गर्ने",
      },
      {
        step: "4. Confirm Payment",
        stepNepali: "४. Confirm गर्ने",
        details: "KRISHOE confirms receipt (usually within 2 hours)",
        detailsNepali: "KRISHOE 2 घन्टामा confirmation गर्छ",
      },
      {
        step: "5. Dispatch & Deliver",
        stepNepali: "५. डिलिभरी भयो",
        details: "Once confirmed, package ships immediately",
        detailsNepali: "Payment भएपछि तुरुन्तै dispatch हुन्छ",
      },
    ],
    benefits: [
      "Direct bank transfer (most secure)",
      "No intermediary commission",
      "QR code for easy scanning",
      "Receipt from bank",
      "Full control over payment",
    ],
    benefitsNepali: [
      "सिधै bank transfer (सबै भन्दा सुरक्षित)",
      "कुनै intermediary commission नेह",
      "QR code सजिलो",
      "Bank को receipt",
      "पूरो नियन्त्रण",
    ],
    processingTime: "1-2 working days (after confirmation)",
    processingTimeNepali: "१-२ दिन (confirmation पछि)",
    note: "Requires manual payment confirmation by KRISHOE team. Best for large orders.",
    noteNepali: "Manual confirmation आवश्यक। बडा orders को लागि सेरा।",
  },
  "Store pickup payment": {
    id: "Store pickup payment",
    title: "Store Pickup - Pay at Store",
    titleNepali: "Store बाट पिकअप",
    icon: "🏪",
    description: "Order online, pay cash when picking up from KRISHOE store",
    descriptionNepali: "Online order गरेर store बाट cash दिएर लिन",
    steps: [
      {
        step: "1. Browse & Order",
        stepNepali: "१. Browse गरेर order गर्ने",
        details: "Select delivery as 'Store pickup'",
        detailsNepali: "Delivery option 'Store pickup' select गर्ने",
      },
      {
        step: "2. Choose Payment Later",
        stepNepali: "२. Payment later गर्ने",
        details: "Select 'Store pickup payment' option",
        detailsNepali: "'Store pickup payment' select गर्ने",
      },
      {
        step: "3. Get Order Ready",
        stepNepali: "३. Order तैयार भयो",
        details: "KRISHOE packs and prepares your order within 4 hours",
        detailsNepali: "KRISHOE 4 घन्टामा order तैयार गर्छ",
      },
      {
        step: "4. Pick Up & Pay",
        stepNepali: "४. पिकअप गरेर पैसा दिने",
        details: "Come to store, verify pairs, pay cash",
        detailsNepali: "Store आएर, check गरेर, नगद दिने",
      },
    ],
    benefits: [
      "Inspect items before paying",
      "No delivery charges",
      "Instant pickup",
      "Cash payment at store",
      "Can exchange items immediately",
    ],
    benefitsNepali: [
      "Payment अगाडि check गर्न सकिने",
      "Delivery charge नलाग्ने",
      "तुरुन्त pickup",
      "Store मा नगद payment",
      "तुरुन्त exchange गर्न सकिने",
    ],
    processingTime: "Same day (within 4 hours)",
    processingTimeNepali: "उही दिन (४ घन्टामा)",
    note: "Available at KRISHOE retail location in Kathmandu",
    noteNepali: "काठमाडौंको KRISHOE store मा उपलब्ध",
  },
};

export default function PaymentMethodGuide({
  selectedPayment,
  orderTotal,
  customerPhone,
}: PaymentMethodGuideProps) {
  const [expanded, setExpanded] = useState(true);
  const method = paymentMethods[selectedPayment as PaymentMethodType];

  if (!method) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border border-brand-green/20 bg-white p-4 sm:p-6">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{method.icon}</span>
          <div className="text-left">
            <p className="text-xs font-semibold uppercase text-gray-500">
              Payment Method
            </p>
            <p className="font-bold text-brand-green-ink">{method.title}</p>
            <p className="text-xs text-gray-600">{method.titleNepali}</p>
          </div>
        </div>
        <ChevronDownIcon
          className={`h-5 w-5 transition ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-6 border-t border-gray-200 pt-6">
          {/* Description */}
          <div>
            <p className="text-sm font-semibold text-brand-green-ink">
              {method.description}
            </p>
            <p className="text-xs text-gray-600">{method.descriptionNepali}</p>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase text-gray-500">
              How it works:
            </p>
            {method.steps.map((step, idx) => (
              <div key={idx} className="flex gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-green/10 text-xs font-bold text-brand-green">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-brand-green-ink">
                    {step.step}
                  </p>
                  <p className="text-xs text-gray-600">{step.stepNepali}</p>
                  <p className="mt-1 text-xs text-gray-600">{step.details}</p>
                  <p className="text-xs text-gray-500">{step.detailsNepali}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Benefits */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase text-gray-500">
              Benefits:
            </p>
            <ul className="space-y-1">
              {method.benefits.map((benefit, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                  <span className="text-gray-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline */}
          <div className="rounded-lg bg-brand-green/5 p-3">
            <div className="text-sm font-semibold text-brand-green-ink">
              ⏱️ Typical Timeline: {method.processingTime}
            </div>
            <div className="text-xs text-gray-600">
              {method.processingTimeNepali}
            </div>
          </div>

          {/* Order Total */}
          {method.id !== "Store pickup payment" && (
            <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-3">
              <p className="text-xs font-semibold text-gray-600 mb-1">
                Total Amount to Pay:
              </p>
              <p className="text-2xl font-black text-brand-green-ink">
                {orderTotal}
              </p>
            </div>
          )}

          {/* Note */}
          <div className="rounded-lg border-l-4 border-brand-gold bg-brand-cream-soft p-3">
            <p className="text-xs font-semibold text-brand-gold-ink">
              📌 {method.note}
            </p>
            <p className="text-xs text-gray-600 mt-1">{method.noteNepali}</p>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 border-t border-gray-200 pt-4">
            <p className="text-xs font-bold uppercase text-gray-500">
              Need Help?
            </p>
            <p className="text-xs text-gray-700">
              📱 Call or WhatsApp us at{" "}
              <a
                href={`https://wa.me/977${customerPhone?.replace(/\D/g, "").slice(-10)}`}
                className="font-bold text-brand-green underline"
              >
                {customerPhone}
              </a>
            </p>
            <p className="text-xs text-gray-700">
              ✉️ Email support@krishoe.com
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
