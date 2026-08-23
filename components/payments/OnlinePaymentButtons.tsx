"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

type Provider = "esewa" | "khalti";

type PaymentResponse = {
  ok?: boolean;
  message?: string;
  gatewayPayload?: {
    method?: string;
    formUrl?: string;
    fields?: Record<string, string>;
    paymentUrl?: string;
  } | null;
};

const providerLabel: Record<Provider, string> = {
  esewa: "eSewa",
  khalti: "Khalti",
};

export default function OnlinePaymentButtons({
  orderId,
  providers,
}: {
  orderId: string;
  providers: Provider[];
}) {
  const { text } = useLanguage();
  const [pendingProvider, setPendingProvider] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  async function startPayment(provider: Provider) {
    setPendingProvider(provider);
    setError("");

    try {
      const response = await fetch(`/api/payments/${provider}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = (await response.json()) as PaymentResponse;

      if (!response.ok || !result.ok || !result.gatewayPayload) {
        throw new Error(result.message || "Payment could not be started.");
      }

      if (
        provider === "esewa" &&
        result.gatewayPayload.method === "POST" &&
        result.gatewayPayload.formUrl &&
        result.gatewayPayload.fields
      ) {
        const form = document.createElement("form");
        form.method = "POST";
        form.action = result.gatewayPayload.formUrl;

        for (const [name, value] of Object.entries(result.gatewayPayload.fields)) {
          const input = document.createElement("input");
          input.type = "hidden";
          input.name = name;
          input.value = value;
          form.appendChild(input);
        }

        document.body.appendChild(form);
        form.submit();
        return;
      }

      if (provider === "khalti" && result.gatewayPayload.paymentUrl) {
        window.location.assign(result.gatewayPayload.paymentUrl);
        return;
      }

      throw new Error("The payment provider did not return a checkout URL.");
    } catch (paymentError) {
      setError(paymentError instanceof Error ? paymentError.message : "Payment could not be started.");
      setPendingProvider(null);
    }
  }

  if (providers.length === 0) return null;

  return (
    <div className="mt-5 rounded-lg border border-brand-green/20 bg-brand-green-mist p-5">
      <h2 className="text-lg font-black text-brand-green-ink">{text("Pay securely online", "अनलाइन सुरक्षित भुक्तानी")}</h2>
      <p className="mt-2 text-sm leading-6 text-brand-muted">
        Your amount is calculated from the saved order. KRISHOE marks it paid only after
        server-side verification from the selected provider.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => startPayment(provider)}
            disabled={pendingProvider !== null}
            className={`inline-flex min-h-12 items-center justify-center rounded-full px-5 text-sm font-black text-white transition disabled:cursor-wait disabled:opacity-60 ${
              provider === "esewa"
                ? "bg-[#60BB46] hover:bg-[#4C9D36]"
                : "bg-[#5C2D91] hover:bg-[#492170]"
            }`}
          >
            {pendingProvider === provider
              ? `Opening ${providerLabel[provider]}...`
              : `Pay with ${providerLabel[provider]}`}
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-brand-clay-mist p-3 text-sm font-bold text-brand-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}
