"use client";

import { useEffect, useState } from "react";

export default function KeyboardShortcutsPage() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        setShowShortcuts(true);
      }
      if (e.key === "Escape") {
        setShowShortcuts(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  const shortcuts = [
    {
      category: "Navigation",
      items: [
        { keys: ["G", "D"], label: "Go to Dashboard" },
        { keys: ["G", "O"], label: "Go to Orders" },
        { keys: ["G", "P"], label: "Go to Products" },
        { keys: ["G", "R"], label: "Go to Reviews" },
        { keys: ["G", "S"], label: "Go to Settings" },
        { keys: ["G", "H"], label: "Go to HR" },
      ],
    },
    {
      category: "Actions",
      items: [
        { keys: ["K"], label: "Quick search" },
        { keys: ["?"], label: "Show this help" },
        { keys: ["Esc"], label: "Close modal or dialog" },
        { keys: ["/"], label: "Focus search" },
      ],
    },
    {
      category: "Forms",
      items: [
        { keys: ["Ctrl/Cmd", "Enter"], label: "Submit form" },
        { keys: ["Ctrl/Cmd", "S"], label: "Save changes" },
        { keys: ["Esc"], label: "Cancel form" },
      ],
    },
    {
      category: "Tables",
      items: [
        { keys: ["←"], label: "Previous page" },
        { keys: ["→"], label: "Next page" },
        { keys: ["J"], label: "Next row" },
        { keys: ["K"], label: "Previous row" },
      ],
    },
  ];

  return (
    <section className="mx-auto max-w-4xl p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-brand-green-ink">⌨️ Keyboard Shortcuts Guide</h1>
        <p className="mt-2 text-gray-600">
          तेजी को साथ काम गर्न यो keyboard shortcuts प्रयोग गर। कुनै पनि पेजमा{" "}
          <kbd className="rounded bg-gray-200 px-2 py-1 font-mono text-sm font-bold">?</kbd> दबाएर यो guide फेरिल्ट गर्न सकिन्छ।
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {shortcuts.map((section) => (
          <div key={section.category} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 font-black text-brand-green-ink">{section.category}</h2>
            <ul className="space-y-3">
              {section.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <div className="flex gap-1">
                    {item.keys.map((key, idx) => (
                      <div key={key} className="flex items-center gap-1">
                        <kbd className="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs font-bold text-gray-700">
                          {key}
                        </kbd>
                        {idx < item.keys.length - 1 && <span className="text-xs text-gray-400">+</span>}
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-brand-green/20 bg-brand-green-wash/30 p-6">
        <h2 className="mb-4 font-black text-brand-green-ink">💡 Tips & Tricks</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0">→</span>
            <span>
              <strong>Go shortcuts:</strong> "G" थिचेर फेरी अक्षर दबाऊ (जस्तै "G D" = Dashboard)। अक्षर hold राख्न पर्दैन, एकैचोटि दबाऊ।
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0">→</span>
            <span>
              <strong>Search focus:</strong> कुनै पनि पेजमा "/" को "K" दबाएर search field मा फोकस गर।
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0">→</span>
            <span>
              <strong>Modal close:</strong> Dialog वा modal खुला भएमा "Esc" दबाएर बन्द गर।
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0">→</span>
            <span>
              <strong>Form submit:</strong> Form भरेर "Ctrl+Enter" (Windows) वा "Cmd+Enter" (Mac) दबाए submit हुन्छ।
            </span>
          </li>
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-black text-brand-green-ink">🎯 Common Workflows</h2>
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 font-bold text-gray-700">Quickly add new product</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <kbd>G</kbd> <span>→</span> <kbd>P</kbd> <span>→ Find Edit button → Fill form</span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-bold text-gray-700">Check new orders</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <kbd>G</kbd> <span>→</span> <kbd>O</kbd> <span>→ View latest orders</span>
            </div>
          </div>
          <div>
            <h3 className="mb-2 font-bold text-gray-700">Moderate reviews</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <kbd>G</kbd> <span>→</span> <kbd>R</kbd> <span>→ Review pending items</span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <p className="font-bold">Pro tip:</p>
        <p className="mt-1">
          अधिकांश browsers मा keyboard shortcuts को लागि "alt" वा "option" key को आवश्यकता हुन सक्छ। यदि shortcut काम गरेन भने browser settings check गर।
        </p>
      </div>
    </section>
  );
}
