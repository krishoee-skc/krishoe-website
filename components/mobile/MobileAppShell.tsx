"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileAppShellProps {
  children: ReactNode;
  userType?: "admin" | "worker" | "customer";
}

export default function MobileAppShell({
  children,
  userType = "customer",
}: MobileAppShellProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);

  const isActive = (path: string) => pathname?.startsWith(path);

  const workerNavigation = [
    { href: "/worker/dashboard", icon: "📊", label: "Dashboard" },
    { href: "/worker/production", icon: "📦", label: "Production" },
    { href: "/worker/attendance", icon: "📅", label: "Attendance" },
    { href: "/worker/payslip", icon: "💰", label: "Payslip" },
  ];

  const customerNavigation = [
    { href: "/shop", icon: "🛍️", label: "Shop" },
    { href: "/cart", icon: "🛒", label: "Cart" },
    { href: "/checkout", icon: "💳", label: "Checkout" },
    { href: "/account", icon: "👤", label: "Account" },
  ];

  const adminNavigation = [
    { href: "/admin", icon: "📊", label: "Dashboard" },
    { href: "/admin/alerts", icon: "🔔", label: "Alerts" },
    { href: "/admin/analytics", icon: "📈", label: "Analytics" },
    { href: "/admin/sms", icon: "📱", label: "SMS" },
  ];

  const navigation =
    userType === "worker"
      ? workerNavigation
      : userType === "admin"
      ? adminNavigation
      : customerNavigation;

  return (
    <div className="min-h-screen bg-white flex flex-col pb-20 md:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👟</span>
            <h1 className="text-lg font-bold">KRISHOE</h1>
          </div>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-xl"
          >
            ☰
          </button>
        </div>

        {/* Mobile Menu */}
        {showMenu && (
          <div className="mt-4 pt-4 border-t border-blue-500 space-y-2">
            <p className="text-sm text-blue-100 mb-2">Quick Links</p>
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm ${
                  isActive(item.href)
                    ? "bg-blue-500 font-medium"
                    : "hover:bg-blue-500"
                }`}
                onClick={() => setShowMenu(false)}
              >
                {item.icon} {item.label}
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">{children}</main>

      {/* Bottom Navigation (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl">
        <div className="flex justify-around">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 px-1 text-xs transition-colors ${
                isActive(item.href)
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-blue-600"
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Install Prompt */}
      <InstallPrompt />
    </div>
  );
}

function InstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  if (typeof window !== "undefined") {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    });
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-600 p-4 shadow-2xl">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">📱</span>
          <div>
            <p className="font-semibold text-gray-900">Install App</p>
            <p className="text-xs text-gray-600">Fast & works offline</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 bg-blue-600 text-white py-2 rounded font-medium text-sm"
          >
            Install
          </button>
          <button
            onClick={() => setShowPrompt(false)}
            className="flex-1 bg-gray-200 text-gray-900 py-2 rounded font-medium text-sm"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
