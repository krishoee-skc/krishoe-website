import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Photo Guide | KRISHOE Admin",
};

// A hands-on guide the owner can follow with just a phone. Static content —
// no data, loads instantly.
export default function PhotoGuidePage() {
  const rules: Array<[string, string, string]> = [
    [
      "☀️",
      "झ्यालको उज्यालोमा खिच्नुहोस्",
      "दिउँसो, झ्यालनजिक। सिधा घाम होइन — छाया बन्छ। बत्तीको पहेंलो उज्यालो र राति नखिच्ने।",
    ],
    [
      "⬜",
      "सफा, एकनास background",
      "सेतो पर्खाल, सेतो कागज, वा खैरो कपडा पछाडि राख्नुहोस्। भुइँको भद्रगोल देखिनु हुँदैन — ग्राहकले जुत्ता मात्र देखोस्।",
    ],
    [
      "✨",
      "जुत्ता चम्काएर मात्र",
      "धुलो पुछ्ने, फित्ता मिलाउने, ट्याग हटाउने। फोनको क्यामेराको lens पनि पुछ्नुहोस् — आधा धमिलो फोटो lens को धुलोले हुन्छ।",
    ],
    [
      "📐",
      "जुत्ताको उचाइबाट, सिधा",
      "उभिएर माथिबाट नखिच्ने। निहुरिएर जुत्ताकै उचाइमा फोन ल्याउनुहोस् — जुत्ता ठूलो र आकर्षक देखिन्छ।",
    ],
    [
      "🔄",
      "एउटै जोडीका ४-५ कोण",
      "छेउबाट (मुख्य फोटो), अगाडिबाट, माथिबाट, पछाडिबाट, र जोडी मिलाएर — ग्राहकले पसलमा जस्तै घुमाई-घुमाई हेर्न पाउँछ।",
    ],
    [
      "🚫",
      "Zoom नगर्ने — नजिक जाने",
      "Zoom ले फोटो धमिलो बनाउँछ। फोन नै जुत्तानजिक लैजानुहोस्। हात नकाँपोस् — कतै अड्याएर खिच्नुहोस्।",
    ],
  ];

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-bold text-brand-green underline underline-offset-4">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink">📸 Photo Guide — फोटोले जुत्ता बेच्छ</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Online मा फोटो नै तपाईंको सेल्सम्यान हो। राम्रो फोटो = ग्राहकको भरोसा = बिक्री। फोनले मात्रै
            पुग्छ — तलका ६ नियम पालना गर्नुहोस्।
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rules.map(([emoji, title, text], index) => (
          <article key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-green-wash text-xl">
                {emoji}
              </span>
              <p className="font-black text-brand-green-ink">
                {index + 1}. {title}
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-gray-600">{text}</p>
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-brand-green/30 bg-brand-green-wash/40 p-5">
        <h2 className="text-lg font-black text-brand-green-ink">⬆️ खिचेपछि — Upload गर्ने तरिका (१ मिनेट)</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-brand-green-ink">
          <li className="rounded-lg border border-brand-green/20 bg-white p-3">
            <span className="font-black">१.</span> <Link href="/admin/products" className="font-bold text-brand-green underline underline-offset-4">Products</Link> मा
            गएर design को <span className="font-bold">Edit</span> थिच्नुहोस्
          </li>
          <li className="rounded-lg border border-brand-green/20 bg-white p-3">
            <span className="font-black">२.</span> <span className="font-bold">Main Image</span> मुनिको{" "}
            <span className="font-bold">&ldquo;Upload photo&rdquo;</span> थिचेर फोनबाट सबैभन्दा राम्रो (छेउबाट खिचेको) फोटो
            रोज्नुहोस्
          </li>
          <li className="rounded-lg border border-brand-green/20 bg-white p-3">
            <span className="font-black">३.</span> <span className="font-bold">Gallery Images</span> मा बाँकी कोणका ३-४ फोटो
            एकैचोटि upload गर्नुहोस्
          </li>
          <li className="rounded-lg border border-brand-green/20 bg-white p-3">
            <span className="font-black">४.</span> <span className="font-bold">Save Changes</span> — फोटो तुरुन्तै shop मा
            देखिन्छ! 🎉
          </li>
        </ol>
      </section>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">✅ खिच्नु अघिको checklist</h2>
        <div className="mt-3 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
          {[
            "दिउँसोको उज्यालो, झ्यालनजिक",
            "सेतो/सफा background",
            "जुत्ता पुछेको, फित्ता मिलेको",
            "फोनको lens पुछेको",
            "जुत्ताको उचाइबाट, सिधा कोण",
            "छेउ + अगाडि + माथि + जोडी — ४ फोटो",
          ].map((item) => (
            <p key={item} className="rounded-md bg-gray-50 px-3 py-2">
              ☑️ {item}
            </p>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-brand-muted-soft">
          टिप: हरेक design को फोटो एउटै ठाउँ, एउटै background मा खिच्दा पूरै पसल professional देखिन्छ।
        </p>
      </section>
    </section>
  );
}
