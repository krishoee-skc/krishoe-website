export const whatsappOrderUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

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
