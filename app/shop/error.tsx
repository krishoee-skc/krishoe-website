"use client";

import RouteError from "@/components/RouteError";

export default function ShopError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} message="The shop grid hit a snag. Please retry, or reload." />;
}
