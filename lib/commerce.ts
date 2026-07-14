import { businessContact } from "@/lib/seo";

// wa.me needs the recipient number in the path, otherwise the customer is
// dropped into WhatsApp with no contact selected and most abandon the order.
export const whatsappOrderUrl = (message: string) =>
  `https://wa.me/${businessContact.whatsappNumber}?text=${encodeURIComponent(message)}`;

// Viber is a primary ordering channel in Nepal alongside WhatsApp.
export const viberOrderUrl = (message: string) =>
  `viber://forward?text=${encodeURIComponent(message)}`;

export const shippingOptions = [
  "Kathmandu valley delivery",
  "Store pickup",
  "Nationwide courier coordination",
];

export const paymentOptions = [
  "Cash on delivery",
  "eSewa / Khalti link after stock confirmation",
  "QR / bank transfer confirmation",
  "Store pickup payment",
];
