/**
 * Nepali display labels for the checkout option values.
 *
 * The keys here are the exact strings in `shippingOptions` / `paymentOptions`,
 * and those same English strings are what the radio inputs submit and what the
 * server validates against (`shippingOptions.includes(delivery)`) and branches
 * on (`delivery !== "Kathmandu valley delivery"`). Translate the label only —
 * submitting a translated value would fail validation and would also write
 * Nepali text into order records the admin screens read back.
 *
 * An option with no entry falls back to its English text, so adding a new
 * option never breaks the form; it just shows untranslated until listed here.
 */
const shippingLabelsNe: Record<string, string> = {
  "Kathmandu valley delivery": "काठमाडौं उपत्यकाभित्र डेलिभरी",
  "Store pickup": "पसलबाटै लिने",
  "Nationwide courier coordination": "देशभर कुरियर मिलाइदिने",
};

const paymentLabelsNe: Record<string, string> = {
  "Cash on delivery": "सामान बुझ्दा नगद (COD)",
  "eSewa / Khalti link after stock confirmation":
    "स्टक पक्का भएपछि eSewa / Khalti लिंक",
  "QR / bank transfer confirmation": "QR / बैंक ट्रान्सफर पुष्टि",
  "Store pickup payment": "पसलमै भुक्तानी",
};

export function shippingOptionLabel(option: string, nepali: boolean) {
  return nepali ? (shippingLabelsNe[option] ?? option) : option;
}

export function paymentOptionLabel(option: string, nepali: boolean) {
  return nepali ? (paymentLabelsNe[option] ?? option) : option;
}
