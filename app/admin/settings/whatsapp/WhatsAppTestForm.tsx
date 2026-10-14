"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/** Send one test message, to see that WhatsApp reaches a phone. */
export default function WhatsAppTestForm({ connected }: { connected: boolean }) {
  const { text } = useLanguage();
  const [adminNumber, setAdminNumber] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const sendTestMessage = async () => {
    if (!adminNumber.trim()) {
      setErrorMessage(text("Enter the phone number to send to.", "कुन नम्बरमा पठाउने, लेख्नुहोस्।"));
      return;
    }

    setIsLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/factory/settings/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: adminNumber,
          message: testMessage || "🧪 KRISHOE WhatsApp test — all working ✅",
        }),
      });

      if (response.ok) {
        setSuccessMessage(text("Test message sent ✅", "परीक्षण सन्देश पठाइयो ✅"));
        setTestMessage("");
      } else {
        const error = await response.json();
        setErrorMessage(error.error || text("The test message was not sent.", "परीक्षण सन्देश गएन।"));
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text("The test message was not sent.", "परीक्षण सन्देश गएन।"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
        {text("Send a test to", "परीक्षण कुन नम्बरमा")}
        <input
          aria-label={text("Phone number", "फोन नम्बर")}
          type="tel"
          placeholder="+9779841234567"
          value={adminNumber}
          onChange={(e) => setAdminNumber(e.target.value)}
          className="min-h-12 w-full rounded-lg border border-brand-green-line px-4 focus:border-transparent focus:ring-2 focus:ring-brand-gold"
        />
      </label>
      <label className="grid gap-1 text-sm font-bold text-brand-green-ink">
        {text("Message (optional)", "सन्देश (नलेखे पनि हुन्छ)")}
        <textarea
          aria-label={text("Test message", "परीक्षण सन्देश")}
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-brand-green-line px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-brand-gold"
        />
      </label>
      <button
        type="button"
        onClick={sendTestMessage}
        disabled={isLoading || !connected}
        className="min-h-12 w-fit rounded-lg bg-green-600 px-6 font-black text-white transition hover:bg-green-700 disabled:bg-brand-muted-soft"
      >
        {isLoading ? text("Sending…", "पठाउँदै…") : text("📱 Send a test", "📱 परीक्षण पठाउने")}
      </button>
      {!connected ? (
        <p className="text-xs text-brand-muted">
          {text("The test waits until WhatsApp is connected.", "WhatsApp नजोडिएसम्म परीक्षण पठाउन मिल्दैन।")}
        </p>
      ) : null}
      {successMessage && <div className="rounded-lg bg-green-100 p-3 text-green-700">{successMessage}</div>}
      {errorMessage && <div className="rounded-lg bg-red-100 p-3 text-red-700">{errorMessage}</div>}
    </div>
  );
}
