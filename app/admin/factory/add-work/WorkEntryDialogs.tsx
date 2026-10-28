"use client";

import { useLanguage } from "@/components/LanguageProvider";

/**
 * The two small windows the work-entry form opens: a new product's name, and
 * the rate for a product that has none yet.
 *
 * Split out of the work-entry form (2026-10-27); unchanged, the English-only
 * buttons included. The form keeps what is typed and does the saving.
 */
export function AddProductDialog({
  name,
  onName,
  onAdd,
  onCancel,
}: {
  name: string;
  onName: (value: string) => void;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-brand-green-ink mb-4">
          ➕ {text("Add new product", "नयाँ सामान थप्ने")}
        </h2>
        <input
          aria-label={text("New product name", "नयाँ सामानको नाम")}
          type="text"
          value={name}
          onChange={(e) => onName(e.target.value)}
          placeholder={text("Product name (e.g. Flatpatta, Sendil)", "जुत्ताको नाम (जस्तै: फ्ल्याटपट्टा, सेन्डिल)")}
          className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
          onKeyPress={(e) => e.key === "Enter" && onAdd()}
        />
        <div className="flex gap-2">
          <button
            onClick={onAdd}
            className="flex-1 bg-brand-green hover:bg-brand-green-ink text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            ✅ Add Product
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function SetRateDialog({
  rate,
  onRate,
  category,
  onSet,
  onCancel,
  error = "",
}: {
  /** Why the last press did not set it, said inside the box (KR-BUG-010). */
  error?: string;
  rate: string;
  onRate: (value: string) => void;
  /** The chosen worker's category, which the rate is set for. */
  category: string | undefined;
  onSet: () => void;
  onCancel: () => void;
}) {
  const { text } = useLanguage();
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-brand-paper rounded-lg p-6 max-w-md w-full shadow-xl">
        <h2 className="text-xl font-bold text-brand-green-ink mb-2">⚙️ Set Rate</h2>
        <p className="text-sm text-brand-muted mb-4">
          Rate not found for this product. Please enter the rate per pair.
        </p>
        <input
          aria-label={text("Rate per pair", "प्रति जोडी दर")}
          type="number"
          value={rate}
          onChange={(e) => onRate(e.target.value)}
          placeholder={text("Rate per pair (e.g. 10, 12, 15)", "प्रति जोडी दर (जस्तै: १०, १२, १५)")}
          className="w-full min-h-12 px-3 py-2 border border-brand-green-line rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent mb-4"
          onKeyPress={(e) => e.key === "Enter" && onSet()}
        />
        <p className="text-xs text-brand-muted mb-4">
          Category: <strong>{category}</strong>
        </p>
        {error ? (
          <p role="alert" className="mb-4 rounded-lg bg-brand-clay-tint px-3 py-2 text-sm font-bold text-brand-clay">
            ✕ {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <button
            onClick={onSet}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            ✅ Set Rate
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-brand-green-line hover:bg-brand-muted-soft text-brand-green-ink font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
