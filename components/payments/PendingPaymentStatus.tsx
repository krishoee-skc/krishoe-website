"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Provider = "esewa" | "khalti";

export default function PendingPaymentStatus({
  orderId,
  provider,
}: {
  orderId: string;
  provider: Provider;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");

  async function checkStatus() {
    setChecking(true);
    setMessage("");

    try {
      const response = await fetch(`/api/payments/${provider}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = (await response.json()) as { message?: string; paymentStatus?: string };
      if (!response.ok) throw new Error(result.message || "Payment status could not be checked.");

      setMessage(
        result.paymentStatus === "Paid"
          ? "Payment verified successfully."
          : result.paymentStatus === "Failed"
            ? "The attempt was not completed. You can try again after refresh."
            : "The provider still reports this payment as pending.",
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment status could not be checked.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="mt-5 rounded-lg border border-[#F4DEAE] bg-[#FFF9EA] p-5">
      <h2 className="text-lg font-black text-brand-green-ink">{text("Payment awaiting verification", "भुक्तानी जाँच हुँदैछ")}</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        Do not pay again yet. Ask {provider === "esewa" ? "eSewa" : "Khalti"} for the
        authoritative status first.
      </p>
      <button
        type="button"
        onClick={checkStatus}
        disabled={checking}
        className="mt-4 inline-flex min-h-11 items-center rounded-full bg-brand-green px-5 text-sm font-black text-white disabled:cursor-wait disabled:opacity-60"
      >
        {checking ? "Checking provider..." : "Check payment status"}
      </button>
      {message ? <p role="status" className="mt-3 text-sm font-bold text-brand-green-ink">{message}</p> : null}
    </div>
  );
}
