import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product Photography Guide | KRISHOE Admin",
};

export default function PhotoGuidePage() {
  const rules: Array<[string, string, string]> = [
    [
      "☀️",
      "झ्यालको उज्यालोमा खिच्नुहोस्",
      "दिउँसो, झ्यालनजिक। सिधा घाम होइन — छाया बन्छ। बत्तीको पहेंलो उज्यालो र राति नखिच्ने। सबैभन्दा राम्रो: दिउँसोको २-४ बजे।",
    ],
    [
      "⬜",
      "सफा, एकनास background",
      "सेतो पर्खाल, सेतो कागज, वा खैरो कपडा पछाडि राख्नुहोस्। भुइँको भद्रगोल देखिनु हुँदैन — ग्राहकले जुत्ता मात्र देखोस्। एकनास background कार्यले पेशेवर देखिन्छ।",
    ],
    [
      "✨",
      "जुत्ता चम्काएर मात्र",
      "धुलो पुछ्ने, फित्ता मिलाउने, ट्याग हटाउने। फोनको क्यामेराको lens पनि पुछ्नुहोस् — आधा धमिलो फोटो lens को धुलोले हुन्छ। नयाँ जुत्ताको जस्तो चमक राख्नुहोस्।",
    ],
    [
      "📐",
      "जुत्ताको उचाइबाट, सिधा",
      "उभिएर माथिबाट नखिच्ने। निहुरिएर जुत्ताकै उचाइमा फोन ल्याउनुहोस् — जुत्ता ठूलो र आकर्षक देखिन्छ। ४५ डिग्री angle सबैभन्दा राम्रो हुन्छ।",
    ],
    [
      "🔄",
      "एउटै जोडीका ४-५ कोण",
      "छेउबाट (मुख्य फोटो), अगाडिबाट, माथिबाट, पछाडिबाट, र जोडी मिलाएर — ग्राहकले पसलमा जस्तै घुमाई-घुमाई हेर्न पाउँछ। हरेक कोणमा ध्यान दिनुहोस्।",
    ],
    [
      "🚫",
      "Zoom नगर्ने — नजिक जाने",
      "Zoom ले फोटो धमिलो बनाउँछ। फोन नै जुत्तानजिक लैजानुहोस्। हात नकाँपोस् — table मा राखेर वा tripod प्रयोग गर खिच्नुहोस्।",
    ],
  ];

  const bestPractices = [
    {
      title: "Background सबैभन्दा महत्त्वपूर्ण",
      tips: [
        "एकनास सेतो, ग्रे वा खैरो background प्रयोग गर",
        "Expensive camera चाहिँदैन — phone को camera पर्याप्त छ",
        "Backdrop बनाउनको लागि सेतो चादर वा दिवार प्रयोग गर",
      ]
    },
    {
      title: "उज्यालो (Lighting) को राज",
      tips: [
        "Natural light (दिन को प्रकाश) सबैभन्दा राम्रो",
        "Artificial light के भेला लागेमा एकै colour को light प्रयोग गर",
        "Shadow हटाउनको लागि diffuser (सेतो कागज/cloth) राख",
      ]
    },
    {
      title: "फोटोको Quality",
      tips: [
        "कम्तिमा 1MB साइजको फोटो upload गर (phone को Default resolution ठीक छ)",
        "Zoom use नगरी जुत्तानजिक जाएर खिच्नुहोस्",
        "Phone को HDR mode on गरे राम्रो परिणाम हुन्छ",
      ]
    },
    {
      title: "Consistency (एकनास रखेको अनुभव)",
      tips: [
        "सबै जुत्ताको फोटो एकै जागा, एकै समय, एकै background मा खिच्नुहोस्",
        "यो online shop को professional look बनाउँछ",
        "ग्राहकको मनमा विश्वास आउँछ जब पूरो catalog एकै स्तरको हुन्छ",
      ]
    },
  ];

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/products" className="text-sm font-bold text-brand-green underline underline-offset-4">
            ← Products
          </Link>
          <h1 className="mt-2 text-2xl font-black text-brand-green-ink">📸 Product Photography Guide — फोटोले जुत्ता बेच्छ</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
            Online मा फोटो नै तपाईंको सेल्सम्यान हो। राम्रो फोटो = ग्राहकको भरोसा = अधिक बिक्री। <span className="font-semibold">Phone मात्र काफी छ —</span> तपाईंलाई महँगो camera चाहिँदैन। सिर्फ सही techniques पालना गर्नु पर्छ।
          </p>
        </div>
      </div>

      {/* Core 6 Rules */}
      <div className="mt-8">
        <h2 className="text-lg font-black text-brand-green-ink mb-4">🎯 छ मुख्य नियम (6 Core Rules)</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rules.map(([emoji, title, text], index) => (
            <article key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-green-wash text-xl">
                  {emoji}
                </span>
                <div>
                  <p className="font-black text-brand-green-ink text-sm">
                    {index + 1}. {title}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{text}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Upload Instructions */}
      <section className="mt-8 rounded-2xl border border-brand-green/30 bg-brand-green-wash/40 p-6">
        <h2 className="text-lg font-black text-brand-green-ink">⬆️ फोटो हाल्ने — ३ पाइला</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6">
          <li className="rounded-lg border border-brand-green/20 bg-white p-3 flex gap-3">
            <span className="font-black text-brand-green-ink flex-shrink-0">१.</span>
            <div>
              <Link href="/admin/products/photos" className="font-bold text-brand-green underline underline-offset-4">फोटो हाल्ने पेज खोल्नुहोस्</Link>
              <p className="text-xs text-gray-600 mt-1">फोटो नभएका सामान माथि, रातो चिन्हसहित देखिन्छन् — खोज्नु पर्दैन।</p>
            </div>
          </li>
          <li className="rounded-lg border border-brand-green/20 bg-white p-3 flex gap-3">
            <span className="font-black text-brand-green-ink flex-shrink-0">२.</span>
            <div>
              <p className="font-bold">📷 खिच्ने वा 🖼️ फाइलबाट थिच्नुहोस्</p>
              <p className="text-xs text-gray-600 mt-1">खिच्ने थिच्दा फोनको camera सिधै खुल्छ। पहिले खिचेको फोटो भए फाइलबाट छान्नुहोस्।</p>
            </div>
          </li>
          <li className="rounded-lg border border-brand-green/20 bg-white p-3 flex gap-3">
            <span className="font-black text-brand-green-ink flex-shrink-0">३.</span>
            <div>
              <p className="font-bold">सकियो</p>
              <p className="text-xs text-gray-600 mt-1">Save थिच्नु पर्दैन — चढ्नेबित्तिकै पसलमा देखिन्छ। धमिलो आयो भने फेरि खिच्नुहोस्, पुरानो आफैँ हट्छ।</p>
            </div>
          </li>
        </ol>
      </section>

      {/* Best Practices */}
      <div className="mt-8">
        <h2 className="text-lg font-black text-brand-green-ink mb-4">💡 Best Practices</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {bestPractices.map(({ title, tips }) => (
            <div key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-brand-green-ink">{title}</h3>
              <ul className="mt-3 space-y-2">
                {tips.map((tip) => (
                  <li key={tip} className="text-xs text-gray-600 flex gap-2">
                    <span className="text-brand-green flex-shrink-0">✓</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Pre-shoot Checklist */}
      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-black text-brand-green-ink">✅ Shooting को अघि यो चेक गर्नुहोस्</h2>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          {[
            "☀️ दिउँसोको २-४ बजे को समय तय गरेको",
            "📱 फोन को battery full छ र memory space छ",
            "🧹 जुत्ता साफ र polish गरेको",
            "⬜ Background तयार गरेको (सेतो कागज/चादर)",
            "📸 Phone को lens पुछेको",
            "🚫 Background मा कुनै objects छैन (bags, खेलणा, आदि)",
          ].map((item) => (
            <div key={item} className="rounded-md bg-green-50 px-3 py-2 border border-green-200">
              <p className="text-sm font-medium text-green-700">{item}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pro Tips */}
      <section className="mt-8 rounded-lg border border-brand-gold/30 bg-brand-gold-wash/20 p-6">
        <h2 className="text-lg font-black text-brand-gold-ink">🌟 Pro Tips (अनुभवी फोटोग्राफरको तरिका)</h2>
        <ul className="mt-4 space-y-3">
          <li className="text-sm text-gray-700 flex gap-3">
            <span className="font-black text-brand-gold-ink flex-shrink-0">→</span>
            <span><span className="font-bold">Tripod आवश्यक छैन।</span> Table मा फोन राखेर खिच्न सक्नुहुन्छ। हात नकाँपोस्, अन्यथा blur हुन्छ।</span>
          </li>
          <li className="text-sm text-gray-700 flex gap-3">
            <span className="font-black text-brand-gold-ink flex-shrink-0">→</span>
            <span><span className="font-bold">एउटै जोडीका ५-६ फोटो खिच्नुहोस्।</span> छानेर सबैभन्दा राम्रो (Clear, Sharp, Well-lit) मात्र राख्नुहोस्।</span>
          </li>
          <li className="text-sm text-gray-700 flex gap-3">
            <span className="font-black text-brand-gold-ink flex-shrink-0">→</span>
            <span><span className="font-bold">सबै designs को फोटो एकै दिनमा खिच्नुहोस्।</span> यसले consistency सुनिश्चित गर्छ।</span>
          </li>
          <li className="text-sm text-gray-700 flex gap-3">
            <span className="font-black text-brand-gold-ink flex-shrink-0">→</span>
            <span><span className="font-bold">Phone settings check गर्नुहोस्।</span> HDR on, Portrait mode off, Maximum quality selected भएको आवश्यक छ।</span>
          </li>
        </ul>
      </section>

      {/* Common Mistakes */}
      <section className="mt-8 rounded-lg border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-black text-red-700">❌ यो गल्तीहरु नगर्नुहोस्</h2>
        <ul className="mt-4 space-y-2 text-sm text-red-600">
          <li>• भुइँमा वा गलीमा जुत्ता फोटो खिच्ने (dirty, unprofessional लाग्छ)</li>
          <li>• Cluttered background (घर को सामान, खेलणा, आदि भूमिका मा)</li>
          <li>• भयानक lighting — बहुत गाढा वा बहुत उज्यालो फोटो</li>
          <li>• Zoom use गर खिच्ने (फोटो blur र pixelated हुन्छ)</li>
          <li>• Duplicate फोटो upload गरी gallery को size नबढाउने</li>
          <li>• Person/foot हराएको जुत्ता को फोटो (size perspective खराब हुन्छ)</li>
        </ul>
      </section>
    </section>
  );
}
