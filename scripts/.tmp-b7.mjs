import { readFileSync, writeFileSync } from "node:fs";
const B = String.fromCharCode(92);
const esc = (v) => v.replace(new RegExp("[.*+?^${}()|[" + B + "]" + B + B + "]", "g"), B + "$&");

function apply(file, pairs, mode) {
  const raw = readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let s = crlf ? raw.split("\r\n").join("\n") : raw;
  let n = 0;
  for (const [en, ne] of pairs) {
    const re = new RegExp(">([" + B + "s]*)" + esc(en) + "([" + B + "s]*)<");
    if (!re.test(s)) throw new Error(file + ": " + en.slice(0, 40));
    const body = mode === "client"
      ? "{text(" + JSON.stringify(en) + ", " + JSON.stringify(ne) + ")}"
      : "<T en=" + JSON.stringify(en) + " ne=" + JSON.stringify(ne) + " />";
    s = s.replace(re, ">$1" + body + "$2<");
    n++;
  }
  if (mode === "server" && !s.includes('from "@/components/T"')) {
    const first = s.match(new RegExp("^import .*$", "m"))[0];
    s = s.replace(first, first + '\nimport T from "@/components/T";');
  }
  if (mode === "client" && !s.includes("useLanguage")) {
    const last = [...s.matchAll(new RegExp("^import .*$", "gm"))].pop()[0];
    s = s.replace(last, last + '\nimport { useLanguage } from "@/components/LanguageProvider";');
    const fn = s.match(new RegExp("export default function [A-Za-z]+" + B + "([^)]*" + B + ")[^{]*{" + B + "n"));
    if (!fn) throw new Error(file + ": component anchor");
    s = s.replace(fn[0], fn[0] + "  const { text } = useLanguage();\n");
  }
  writeFileSync(file, crlf ? s.split("\n").join("\r\n") : s);
  console.log(file + ": " + n + " ✅");
}

apply("components/account/AccountRegisterForm.tsx", [
  ["Full name", "पूरा नाम"],
  ["Password", "पासवर्ड"],
  ["Sign in", "लगइन"],
], "client");

apply("components/account/ResetPasswordForm.tsx", [
  ["Reset Your Password", "पासवर्ड फेर्नुहोस्"],
  ["Enter a new password for your account.", "नयाँ पासवर्ड राख्नुहोस्।"],
  ["New password", "नयाँ पासवर्ड"],
  ["Confirm new password", "नयाँ पासवर्ड फेरि"],
], "client");

apply("components/OrderSummary.tsx", [
  ["Order review", "अर्डर जाँच्नुहोस्"],
  ["Stock check before dispatch", "पठाउनुअघि स्टक जाँचिन्छ"],
  ["Payment matched with order reference", "अर्डर नम्बरसँग भुक्तानी मिलाइन्छ"],
  ["Private order page after request", "अर्डरपछि आफ्नै पाना पाइन्छ"],
], "client");

// The bank name, the account name and the address are not translated: they are
// what a teller and a banking app must be given letter for letter.
apply("components/PaymentInstructions.tsx", [
  ["After payment, send a screenshot on WhatsApp for faster confirmation.",
   "तिरेपछि WhatsApp मा screenshot पठाउनुहोस् — छिटो पक्का हुन्छ।"],
], "server");

apply("components/WishlistClient.tsx", [
  ["Wishlist", "मन परेका"],
  ["Save pairs you love.", "मन परेका जुत्ता बचाउनुहोस्।"],
  ["Tap the heart on a product to build a more personal KRISHOE collection.",
   "जुत्तामा ♡ थिच्नुहोस् — यहीँ जम्मा हुन्छ।"],
  ["Discover products", "जुत्ता हेर्ने"],
], "client");

apply("app/account/register/page.tsx", [
  ["New KRISHOE customer", "नयाँ KRISHOE ग्राहक"],
  ["Create your account.", "खाता खोल्नुहोस्।"],
  ["Keep your name, email, phone, and delivery address ready for checkout.",
   "नाम, इमेल, फोन र ठेगाना एक पटक राख्नुहोस् — अर्को पटक अर्डर छिटो हुन्छ।"],
], "server");

apply("app/global-error.tsx", [
  ["We need a quick retry.", "केही अड्कियो — फेरि प्रयास गर्नुहोस्।"],
  ["Try again", "फेरि प्रयास"],
], "client");
