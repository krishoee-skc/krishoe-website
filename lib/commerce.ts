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

// Sharing a product with a friend, which is the opposite direction from the
// ordering links above: no recipient in the path, so the app opens its own
// contact picker and the shopper chooses who to send it to. Passing the shop's
// number here would silently turn "send this to a friend" into "message the
// shop", so these are kept separate on purpose.
export const whatsappShareUrl = (message: string) =>
  `https://wa.me/?text=${encodeURIComponent(message)}`;

export const viberShareUrl = (message: string) =>
  `viber://forward?text=${encodeURIComponent(message)}`;

// Facebook's sharer reads the page's Open Graph tags for the title, image and
// description, so it takes the URL alone and ignores any message we pass.
export const facebookShareUrl = (url: string) =>
  `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

export const shippingOptions = [
  "Kathmandu valley delivery",
  "Store pickup",
  "Nationwide courier coordination",
];

const outsideValleyPlaces = [
  "bharatpur",
  "chitwan",
  "pokhara",
  "biratnagar",
  "birgunj",
  "butwal",
  "hetauda",
  "janakpur",
  "dharan",
  "itahari",
  "nepalgunj",
  "dhangadhi",
  "surkhet",
  "baglung",
  "birtamod",
  "damak",
];

export function validateDeliveryArea(delivery: string, address: string) {
  if (!shippingOptions.includes(delivery)) {
    return "Please choose a valid delivery option.";
  }

  if (delivery !== "Kathmandu valley delivery") {
    return "";
  }

  const normalizedAddress = address.toLowerCase();
  const outsidePlace = outsideValleyPlaces.find((place) => normalizedAddress.includes(place));

  return outsidePlace
    ? `${outsidePlace.charAt(0).toUpperCase()}${outsidePlace.slice(1)} is outside Kathmandu Valley. Please choose Nationwide courier coordination.`
    : "";
}

export const paymentOptions = [
  "Cash on delivery",
  "eSewa / Khalti link after stock confirmation",
  "QR / bank transfer confirmation",
  "Store pickup payment",
];
