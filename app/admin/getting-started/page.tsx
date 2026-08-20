import Link from "next/link";
import type { Metadata } from "next";
import { getProducts } from "@/lib/product-store";

export const metadata: Metadata = {
  title: "Getting Started | KRISHOE Admin",
};

/**
 * The page that tells the owner where they actually are.
 *
 * It opened with a five-step checklist for the first week, written down here,
 * on a shop that finished those steps months ago: upload your first products,
 * set up email alerts, fill in company settings — all long done, none of them
 * ever able to tick, and one of them pointing at a settings page that has no
 * such field, because the payment keys live in the host's environment. A list
 * that cannot be completed is not a list; after the second reading it teaches
 * its reader to skip the page.
 *
 * So the steps are read from the shop instead. Four products, every one
 * photographed and priced, and not a single pair in stock — that is the state
 * today, and it is also the one thing standing between this shop and its first
 * real sale. A checklist is worth keeping only if it can say that.
 *
 * The keyboard shortcuts section is gone. It listed six — `?`, `G then D`, `G
 * then O`, `G then P`, `K`, `Esc` — and not one of them was ever built. `K`
 * came closest and was wrong twice over: it is Ctrl+K, and the palette it opens
 * is mounted on the storefront navbar, not in admin. Pressing the keys did
 * nothing, which reads as a broken app rather than an unbuilt feature.
 */
export default async function GettingStartedPage() {
  const products = await getProducts();
  const photographed = products.filter((product) => product.image.trim().length > 0);
  const priced = products.filter((product) => product.priceValue > 0);
  const inStock = products.filter((product) => product.stock > 0);
  const emailReady = Boolean(process.env.EMAIL_PROVIDER_URL?.trim());

  const steps = [
    {
      title: "सामान राख्नुहोस्",
      detail: "पसलमा देखिने जुत्ता — नाम र विवरणसहित",
      href: "/admin/products",
      done: products.length > 0,
      status: products.length > 0 ? `${products.length} वटा राखिएको` : "एउटै छैन",
    },
    {
      title: "फोटो हाल्नुहोस्",
      detail: "फोटो नभएको जुत्ता कसैले किन्दैन",
      href: "/admin/products/photo-guide",
      done: products.length > 0 && photographed.length === products.length,
      status:
        products.length > 0
          ? `${photographed.length}/${products.length} मा फोटो छ`
          : "पहिले सामान राख्नुहोस्",
    },
    {
      title: "मूल्य हाल्नुहोस्",
      detail: "ग्राहकले तिर्ने रकम",
      href: "/admin/products",
      done: products.length > 0 && priced.length === products.length,
      status:
        products.length > 0
          ? `${priced.length}/${products.length} मा मूल्य छ`
          : "पहिले सामान राख्नुहोस्",
    },
    {
      title: "स्टक हाल्नुहोस्",
      detail: "कति जोडी छ भनेर नहालेसम्म पसलमा SOLD OUT देखिन्छ",
      href: "/admin/stock",
      done: inStock.length > 0,
      status:
        inStock.length > 0
          ? `${inStock.length} वटामा माल छ`
          : "सबै जुत्ता SOLD OUT — कसैले किन्न सक्दैन",
    },
    {
      title: "अर्डरको खबर",
      detail: "नयाँ अर्डर आउनासाथ email आउने",
      href: "/admin/notifications",
      done: emailReady,
      status: emailReady ? "चलिरहेको छ" : "अझै मिलाइएको छैन",
    },
  ];

  const remaining = steps.filter((step) => !step.done);

  const guides = [
    {
      icon: "📸",
      title: "फोटो खिच्ने तरिका",
      description: "फोनले नै पसलजस्तो फोटो कसरी खिच्ने",
      href: "/admin/products/photo-guide",
      time: "५ मिनेट पढ्ने",
    },
    {
      icon: "📦",
      title: "सामान थप्ने",
      description: "नयाँ जुत्ता — नाम, विवरण र मूल्यसहित",
      href: "/admin/products",
      time: "१५ मिनेट",
    },
    {
      icon: "🏭",
      title: "कारखानाको काम टिप्ने",
      description: "कामदारले बनाएको जोडी र ज्याला",
      href: "/admin/factory/add-work",
      time: "दिनहुँ",
    },
    {
      icon: "⭐",
      title: "ग्राहकको राय",
      description: "पसलमा देखाउनुअघि हेर्ने र स्वीकृत गर्ने",
      href: "/admin/reviews",
      time: "बेला-बेला",
    },
  ];

  const features = [
    {
      category: "बिक्री र अर्डर",
      icon: "🛒",
      items: [
        { name: "Orders", href: "/admin/orders", desc: "ग्राहकका अर्डर हेर्ने र पठाउने" },
        { name: "POS", href: "/admin/pos", desc: "पसलमै बेचेको बिल काट्ने" },
        { name: "Payments", href: "/admin/payments", desc: "पैसा आयो कि आएन मिलाउने" },
      ],
    },
    {
      category: "सामान",
      icon: "👟",
      items: [
        { name: "Products", href: "/admin/products", desc: "जुत्ताको सूची र विवरण" },
        { name: "Stock", href: "/admin/stock", desc: "कुन साइजमा कति जोडी छ" },
        { name: "Photo Guide", href: "/admin/products/photo-guide", desc: "फोटो खिच्ने तरिका" },
      ],
    },
    {
      category: "उत्पादन",
      icon: "⚙️",
      items: [
        { name: "Operations", href: "/admin/operations", desc: "उत्पादन र खाता" },
        { name: "Factory", href: "/admin/factory", desc: "कामदार र ज्याला" },
        { name: "Purchasing", href: "/admin/purchasing", desc: "कच्चा पदार्थ र साहु" },
      ],
    },
    {
      category: "मान्छे",
      icon: "👥",
      items: [
        { name: "HR", href: "/admin/hr", desc: "कर्मचारीको रेकर्ड र तलब" },
        { name: "Customers", href: "/admin/customers", desc: "ग्राहक र उनीहरूको किनमेल" },
        { name: "Devices", href: "/admin/devices", desc: "कुन फोन/computer बाट पस्यो" },
      ],
    },
    {
      category: "हिसाब",
      icon: "📊",
      items: [
        { name: "Insights", href: "/admin/insights", desc: "बिक्री र नाफाको हिसाब" },
        { name: "Costing", href: "/admin/costing", desc: "एक जोडीमा कति लाग्छ" },
        { name: "Settings", href: "/admin/settings", desc: "पसलको नाम, ठेगाना, शाखा" },
      ],
    },
    {
      category: "सम्पर्क",
      icon: "💬",
      items: [
        { name: "Reviews", href: "/admin/reviews", desc: "ग्राहकको राय हेर्ने" },
        { name: "Messages", href: "/admin/messages", desc: "सम्पर्क फारमबाट आएका सन्देश" },
        { name: "Notifications", href: "/admin/notifications", desc: "खबर र email सेटअप" },
      ],
    },
  ];

  return (
    <section className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-brand-green-ink">KRISHOE Admin</h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          {remaining.length === 0
            ? "सबै तयार छ। पसल बेच्न तयार छ।"
            : `पसल बेच्न तयार हुन ${remaining.length} काम बाँकी छ।`}
        </p>
      </div>

      {/* What is left, read from the shop rather than written down here. */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">अहिलेको अवस्था</h2>
        <div className="space-y-3">
          {steps.map((step) => (
            <Link
              key={step.title}
              href={step.href}
              className={`group flex items-start gap-4 rounded-lg border p-4 transition hover:shadow-md ${
                step.done ? "border-gray-200 bg-white" : "border-amber-300 bg-amber-50"
              }`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-bold text-white ${
                  step.done ? "bg-brand-green" : "bg-amber-500"
                }`}
              >
                {step.done ? "✓" : "!"}
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-green-ink group-hover:text-brand-green">{step.title}</p>
                <p className="text-sm text-gray-600">{step.detail}</p>
                <p className={`mt-1 text-xs font-bold ${step.done ? "text-brand-green" : "text-amber-700"}`}>
                  {step.status}
                </p>
              </div>
              <span className="text-gray-400 group-hover:text-brand-green">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">सिक्ने कुरा</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-brand-green hover:shadow-md"
            >
              <div className="mb-2 text-3xl">{guide.icon}</div>
              <h3 className="font-bold text-brand-green-ink group-hover:text-brand-green">{guide.title}</h3>
              <p className="mt-1 text-xs text-gray-600">{guide.description}</p>
              <p className="mt-2 text-xs font-semibold text-gray-500">{guide.time}</p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">कुन काम कहाँ छ</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((category) => (
            <div key={category.category} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-brand-green-ink">
                <span className="text-xl">{category.icon}</span>
                {category.category}
              </h3>
              <ul className="space-y-2">
                {category.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-xs font-bold text-brand-green-ink hover:text-brand-green">
                      {item.name}
                    </Link>
                    <p className="text-xs text-gray-600">{item.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
