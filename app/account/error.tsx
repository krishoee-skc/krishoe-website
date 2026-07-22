"use client";

import RouteError from "@/components/RouteError";

export default function AccountError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} message="Your account page hit a snag. Please retry." />;
}
