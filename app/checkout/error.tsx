"use client";

import RouteError from "@/components/RouteError";

export default function CheckoutError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      reset={reset}
      title="Checkout needs a quick retry."
      message="Your cart is safe and nothing was charged. Please try again."
    />
  );
}
