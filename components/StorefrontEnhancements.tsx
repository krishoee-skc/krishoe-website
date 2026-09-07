"use client";

import { usePathname } from "next/navigation";
import AiAssistant from "@/components/AiAssistant";
import BottomTabBar from "@/components/BottomTabBar";
import { Analytics } from "@/components/commerce/Analytics";
import LanguageInvite from "@/components/LanguageInvite";
import PwaInstallHelp from "@/components/PwaInstallHelp";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import SpeedReporter from "@/components/SpeedReporter";

// These are customer-shop tools. Loading their effects and event listeners on
// the admin desk, worker portal, or private customer account adds work without
// helping the person who is signed in there.
const PRIVATE_APP_PREFIXES = ["/admin", "/worker", "/account", "/customer"];

export default function StorefrontEnhancements() {
  const pathname = usePathname();

  if (PRIVATE_APP_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  return (
    <>
      <ServiceWorkerRegistration />
      <Analytics />
      <PwaInstallHelp />
      <SpeedReporter />
      <LanguageInvite />
      <BottomTabBar />
      <AiAssistant />
    </>
  );
}
