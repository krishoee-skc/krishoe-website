"use client";

import { useState } from "react";
import Link from "next/link";

export default function WhatsAppSettingsPage() {
  const [adminNumber, setAdminNumber] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);

  const sendTestMessage = async () => {
    if (!adminNumber.trim()) {
      setErrorMessage("Please enter an admin phone number");
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
          message: testMessage || "🧪 WhatsApp Integration Test Message - All working! ✅",
        }),
      });

      if (response.ok) {
        setSuccessMessage("Test message sent successfully! ✅");
        setTestMessage("");
      } else {
        const error = await response.json();
        setErrorMessage(error.error || "Failed to send test message");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Error sending test message");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-paper-deep p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="text-brand-green hover:text-brand-green-ink mb-4 inline-block">
            ← Back to Admin
          </Link>
          <h1 className="font-display text-3xl font-black text-brand-green-ink">WhatsApp Settings</h1>
          <p className="text-brand-muted mt-2">Configure WhatsApp integration for admin notifications</p>
        </div>

        {/* Settings Card */}
        <div className="bg-brand-paper rounded-lg shadow-md p-6 mb-6">
          {/* Enable/Disable Toggle */}
          <div className="mb-6 pb-6 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-brand-green-ink">WhatsApp Integration</h2>
                <p className="text-sm text-brand-muted mt-1">
                  {whatsappEnabled ? "✅ Enabled" : "❌ Disabled"}
                </p>
              </div>
              <button
                onClick={() => setWhatsappEnabled(!whatsappEnabled)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  whatsappEnabled
                    ? "bg-green-100 text-green-700 hover:bg-green-200"
                    : "bg-brand-mist text-brand-muted-deep hover:bg-brand-green-line"
                }`}
              >
                {whatsappEnabled ? "Disable" : "Enable"}
              </button>
            </div>
          </div>

          {/* Admin Number Configuration */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-brand-muted-deep mb-2">
              Admin WhatsApp Number
            </label>
            <input
              type="tel"
              placeholder="+977XXXXXXXXXX"
              value={adminNumber}
              onChange={(e) => setAdminNumber(e.target.value)}
              className="w-full px-4 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
            <p className="text-xs text-brand-muted mt-1">
              Format: +977XXXXXXXXXX (Nepal example: +9779841234567)
            </p>
          </div>

          {/* Test Message Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-brand-muted-deep mb-2">
              Test Message
            </label>
            <textarea
              placeholder="Enter a test message or leave empty for default test message"
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent"
            />
            <button
              onClick={sendTestMessage}
              disabled={isLoading || !whatsappEnabled}
              className="mt-3 bg-green-600 hover:bg-green-700 disabled:bg-brand-muted-soft text-white font-medium py-2 px-6 rounded-lg transition"
            >
              {isLoading ? "Sending..." : "📱 Send Test Message"}
            </button>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg">
              {successMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Configuration Info Card */}
        <div className="bg-brand-green-wash border border-brand-green-line rounded-lg p-6">
          <h3 className="text-lg font-semibold text-brand-green mb-3">🔧 Setup Instructions</h3>
          <ol className="space-y-2 text-sm text-brand-green">
            <li>
              <strong>1. Set up Twilio:</strong> Create account at{" "}
              <a
                href="https://www.twilio.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline"
              >
                twilio.com
              </a>
            </li>
            <li>
              <strong>2. Get credentials:</strong> Copy Account SID, Auth Token, and WhatsApp Number
            </li>
            <li>
              <strong>3. Set environment variables:</strong> Add to Vercel/deployment environment
            </li>
            <li>
              <strong>4. Test connection:</strong> Use the test message form above to verify setup
            </li>
          </ol>
        </div>

        {/* Templates Info */}
        <div className="mt-6 bg-brand-paper-deep rounded-lg p-6">
          <h3 className="text-lg font-semibold text-brand-green-ink mb-3">📧 Message Templates</h3>
          <div className="space-y-3 text-sm text-brand-muted-deep">
            <div>
              <strong>Work Entry Notification:</strong> Sent when new work is added
              <p className="text-brand-muted mt-1">
                "नयाँ काम entry: Worker - Product - Pairs - Amount"
              </p>
            </div>
            <div>
              <strong>Daily Summary:</strong> Sent at 8 PM each day
              <p className="text-brand-muted mt-1">
                "आज को Summary: Total Pairs - Total Amount - Workers - Completed"
              </p>
            </div>
            <div>
              <strong>Payment Reminder:</strong> Manual trigger for payment notifications
              <p className="text-brand-muted mt-1">"💰 Payment Reminder: Worker - Amount - Due Date"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
