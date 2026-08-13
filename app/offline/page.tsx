"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OfflinePage() {
  const router = useRouter();
  const [backOnline, setBackOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setBackOnline(true);
      window.setTimeout(() => window.location.reload(), 800);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-gray-50 to-gray-100 p-4">
      <div className="max-w-md text-center">
        <div aria-hidden="true" className="mb-6 text-6xl">📡</div>
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {backOnline ? "Back online" : "You are offline"}
        </h1>
        <p className="mb-6 text-gray-600">
          {backOnline
            ? "Reconnecting to KRISHOE…"
            : "Check your connection, then try again. Private account, worker, admin, order, and payment data are never stored in the offline cache."}
        </p>

        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 text-left text-sm leading-6 text-gray-600">
          Your cart and wishlist remain on this device. Reconnect before checking stock,
          placing an order, signing in, or verifying a payment.
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
          >
            Try home
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-lg bg-gray-200 py-3 font-medium text-gray-900 hover:bg-gray-300"
          >
            Go back
          </button>
        </div>
      </div>
    </main>
  );
}
