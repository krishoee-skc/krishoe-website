"use client";

import { useLanguage } from "@/components/LanguageProvider";
import { chequeMessage, type Cheque } from "@/lib/cheque-book-rules";
import { whatsappTo } from "@/lib/review-ask-rules";

/**
 * One tap to tell the other side about their cheque — before its date, when
 * it clears, when it bounces, or (for a supplier) when they may cash it. It
 * opens WhatsApp with the words filled in; the Owner presses send.
 */
export default function ChequeWhatsApp({ cheque, dateWords }: { cheque: Cheque; dateWords: string }) {
  const { text } = useLanguage();
  const words = chequeMessage(cheque, dateWords);
  const message = text(words.en, words.ne);
  const to = whatsappTo(cheque.partyPhone);
  const label =
    cheque.direction === "out"
      ? text("💬 Tell the supplier", "💬 Supplier लाई भन्ने")
      : cheque.state === "bounced"
        ? text("💬 Ask to pay", "💬 तिर्न भन्ने")
        : cheque.state === "cleared"
          ? text("💬 Thank the customer", "💬 धन्यवाद भन्ने")
          : text("💬 Tell the customer", "💬 ग्राहकलाई भन्ने");
  return (
    <a
      href={`https://wa.me/${to}?text=${encodeURIComponent(message)}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex min-h-11 items-center rounded-xl bg-[#1E8E4E] px-4 text-base font-black text-white"
      title={to ? undefined : text("No mobile number — WhatsApp will ask whom to send it to.", "मोबाइल नम्बर छैन — WhatsApp ले कसलाई पठाउने भनेर सोध्छ।")}
    >
      {label}
    </a>
  );
}
