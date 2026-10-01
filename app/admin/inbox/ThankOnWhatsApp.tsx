"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { whatsappTo } from "@/lib/review-ask-rules";

/**
 * One tap to thank the customer for their review (owner, 2026-10-01). It opens
 * WhatsApp with the words filled in; the Owner presses send. Without a mobile
 * on the review, WhatsApp asks whom to send it to.
 */
export default function ThankOnWhatsApp({ name, phone, shoe }: { name: string; phone: string; shoe: string }) {
  const { text } = useLanguage();
  const who = name.trim();
  const message = text(
    `Namaste${who ? ` ${who}` : ""} 🙏 Thank you for your review${shoe ? ` of ${shoe}` : ""}! It helps other customers choose. — KRISHOE`,
    `नमस्ते${who ? ` ${who} जी` : ""} 🙏 ${shoe ? `${shoe} बारे ` : ""}राय दिनुभएकोमा धन्यवाद! यसले अरू ग्राहकलाई छान्न सजिलो हुन्छ। — KRISHOE`,
  );
  return (
    <a
      href={`https://wa.me/${whatsappTo(phone)}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center rounded-xl bg-[#1E8E4E] px-4 text-base font-black text-white"
    >
      {text("💬 Thank on WhatsApp", "💬 WhatsApp मा धन्यवाद")}
    </a>
  );
}
