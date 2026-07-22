"use client";

import RouteError from "@/components/RouteError";

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} message="This product could not load just now. Please retry, or browse the shop." />;
}
