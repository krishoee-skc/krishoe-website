import { businessContact } from "@/lib/seo";

// wa.me needs the recipient number in the path, otherwise the customer is
// dropped into WhatsApp with no contact selected and most abandon the order.
export const whatsappOrderUrl = (message: string) =>
  `https://wa.me/${businessContact.whatsappNumber}?text=${encodeURIComponent(message)}`;

// Viber is a primary ordering channel in Nepal alongside WhatsApp.
export const viberOrderUrl = (message: string) =>
  `viber://forward?text=${encodeURIComponent(message)}`;

// Open WhatsApp addressed to a specific customer's number — used to send a
// customer their bill, the reverse of whatsappOrderUrl (which targets the
// shop). Nepal numbers are stored locally as 10 digits (98xxxxxxxx); wa.me
// needs the 977 country code, so add it when it is missing.
export const whatsappToUrl = (phone: string, message: string) => {
  const digits = phone.replace(/\D/g, "");
  const withCode = digits.length === 10 && digits.startsWith("9") ? `977${digits}` : digits;
  return `https://wa.me/${withCode}?text=${encodeURIComponent(message)}`;
};

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
