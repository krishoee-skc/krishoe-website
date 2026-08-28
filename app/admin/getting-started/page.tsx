import Link from "next/link";
import T from "@/components/T";
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
      titleNe: "सामान राख्नुहोस्",
      titleEn: "Put the products in",
      detailNe: "पसलमा देखिने जुत्ता — नाम र विवरणसहित",
      detailEn: "The shoes the shop shows — with a name and a description",
      href: "/admin/products",
      done: products.length > 0,
      statusNe: products.length > 0 ? `${products.length} वटा राखिएको` : "एउटै छैन",
      statusEn: products.length > 0 ? `${products.length} in` : "None yet",
    },
    {
      titleNe: "फोटो हाल्नुहोस्",
      titleEn: "Add the photographs",
      detailNe: "फोटो नभएको जुत्ता कसैले किन्दैन",
      detailEn: "Nobody buys a shoe they cannot see",
      // Where the photographs are actually added. This step used to open the
      // photography guide instead — so "Add the photographs" handed the reader
      // something to read, and they had to find the screen themselves.
      href: "/admin/products/photos",
      done: products.length > 0 && photographed.length === products.length,
      statusNe:
        products.length > 0
          ? `${photographed.length}/${products.length} मा फोटो छ`
          : "पहिले सामान राख्नुहोस्",
      statusEn:
        products.length > 0
          ? `${photographed.length}/${products.length} photographed`
          : "Put the products in first",
    },
    {
      titleNe: "मूल्य हाल्नुहोस्",
      titleEn: "Set the prices",
      detailNe: "ग्राहकले तिर्ने रकम",
      detailEn: "What a customer pays",
      href: "/admin/products",
      done: products.length > 0 && priced.length === products.length,
      statusNe:
        products.length > 0
          ? `${priced.length}/${products.length} मा मूल्य छ`
          : "पहिले सामान राख्नुहोस्",
      statusEn:
        products.length > 0
          ? `${priced.length}/${products.length} priced`
          : "Put the products in first",
    },
    {
      titleNe: "स्टक हाल्नुहोस्",
      titleEn: "Enter the stock",
      detailNe: "कति जोडी छ भनेर नहालेसम्म पसलमा SOLD OUT देखिन्छ",
      detailEn: "Until the shop is told how many pairs there are, it shows SOLD OUT",
      href: "/admin/stock",
      done: inStock.length > 0,
      statusNe:
        inStock.length > 0
          ? `${inStock.length} वटामा माल छ`
          : "सबै जुत्ता SOLD OUT — कसैले किन्न सक्दैन",
      statusEn:
        inStock.length > 0
          ? `${inStock.length} have stock`
          : "Everything reads SOLD OUT — nobody can buy",
    },
    {
      titleNe: "अर्डरको खबर",
      titleEn: "Word of a new order",
      detailNe: "नयाँ अर्डर आउनासाथ email आउने",
      detailEn: "An email the moment an order arrives",
      href: "/admin/notifications",
      done: emailReady,
      statusNe: emailReady ? "चलिरहेको छ" : "अझै मिलाइएको छैन",
      statusEn: emailReady ? "Working" : "Not set up yet",
    },
  ];

  const remaining = steps.filter((step) => !step.done);

  const guides = [
    {
      icon: "📦",
      titleNe: "सामान थप्ने",
      titleEn: "Adding a product",
      descriptionNe: "नयाँ जुत्ता — नाम, विवरण र मूल्यसहित",
      descriptionEn: "A new shoe — name, description and price",
      href: "/admin/products",
      timeNe: "१५ मिनेट",
      timeEn: "15 minutes",
    },
    {
      icon: "🏭",
      titleNe: "कारखानाको काम टिप्ने",
      titleEn: "Entering the day's work",
      descriptionNe: "कामदारले बनाएको जोडी र ज्याला",
      descriptionEn: "The pairs a worker made, and the wage",
      href: "/admin/factory/add-work",
      timeNe: "दिनहुँ",
      timeEn: "Every day",
    },
    {
      icon: "⭐",
      titleNe: "ग्राहकको राय",
      titleEn: "What customers said",
      descriptionNe: "पसलमा देखाउनुअघि हेर्ने र स्वीकृत गर्ने",
      descriptionEn: "Read it and approve it before the shop shows it",
      href: "/admin/reviews",
      timeNe: "बेला-बेला",
      timeEn: "Now and then",
    },
  ];

  const features = [
    {
      categoryNe: "बिक्री र अर्डर",
      categoryEn: "Selling and orders",
      icon: "🛒",
      items: [
        { name: "Orders", href: "/admin/orders", descNe: "ग्राहकका अर्डर हेर्ने र पठाउने", descEn: "See a customer's order and send it" },
        { name: "POS", href: "/admin/pos", descNe: "पसलमै बेचेको बिल काट्ने", descEn: "Bill a sale made at the counter" },
        { name: "Payments", href: "/admin/payments", descNe: "पैसा आयो कि आएन मिलाउने", descEn: "Reconcile what has been paid" },
      ],
    },
    {
      categoryNe: "सामान",
      categoryEn: "Products",
      icon: "👟",
      items: [
        { name: "Products", href: "/admin/products", descNe: "जुत्ताको सूची र विवरण", descEn: "The list of shoes and their details" },
        { name: "Stock", href: "/admin/stock", descNe: "कुन साइजमा कति जोडी छ", descEn: "How many pairs in which size" },
        { name: "Photos", href: "/admin/products/photos", descNe: "जुत्ताको फोटो खिच्ने र चढाउने", descEn: "Photograph the shoes and upload them" },
      ],
    },
    {
      categoryNe: "उत्पादन",
      categoryEn: "Production",
      icon: "⚙️",
      items: [
        { name: "Operations", href: "/admin/operations", descNe: "उत्पादन र खाता", descEn: "Production and its accounts" },
        { name: "Factory", href: "/admin/factory", descNe: "कामदार र ज्याला", descEn: "Workers and wages" },
        { name: "Purchasing", href: "/admin/purchasing", descNe: "कच्चा पदार्थ र साहु", descEn: "Raw materials and suppliers" },
      ],
    },
    {
      categoryNe: "मान्छे",
      categoryEn: "People",
      icon: "👥",
      items: [
        { name: "Workers", href: "/admin/factory/workers", descNe: "कामदारको सूची र ज्याला", descEn: "The worker list and their wages" },
        { name: "Customers", href: "/admin/customers", descNe: "ग्राहक र उनीहरूको किनमेल", descEn: "Customers and what they bought" },
        { name: "Devices", href: "/admin/devices", descNe: "कुन फोन/computer बाट पस्यो", descEn: "Which phone or computer signed in" },
      ],
    },
    {
      categoryNe: "हिसाब",
      categoryEn: "Reports",
      icon: "📊",
      items: [
        { name: "Insights", href: "/admin/insights", descNe: "बिक्री र नाफाको हिसाब", descEn: "Sales and profit" },
        { name: "Costing", href: "/admin/costing", descNe: "एक जोडीमा कति लाग्छ", descEn: "What one pair costs to make" },
        { name: "Settings", href: "/admin/settings", descNe: "पसलको नाम, ठेगाना, शाखा", descEn: "Shop name, address, branches" },
      ],
    },
    {
      categoryNe: "सम्पर्क",
      categoryEn: "Getting in touch",
      icon: "💬",
      items: [
        { name: "Reviews", href: "/admin/reviews", descNe: "ग्राहकको राय हेर्ने", descEn: "Read what customers said" },
        { name: "Messages", href: "/admin/messages", descNe: "सम्पर्क फारमबाट आएका सन्देश", descEn: "Messages from the contact form" },
        { name: "Notifications", href: "/admin/notifications", descNe: "खबर र email सेटअप", descEn: "Alerts and email setup" },
      ],
    },
  ];

  return (
    <section className="p-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-black leading-tight text-brand-green-ink">KRISHOE Admin</h1>
        <p className="mt-2 max-w-3xl text-brand-muted">
          {remaining.length === 0 ? (
            <T en="Everything is ready. The shop can sell." ne="सबै तयार छ। पसल बेच्न तयार छ।" />
          ) : (
            <T
              en={`${remaining.length} things left before the shop can sell.`}
              ne={`पसल बेच्न तयार हुन ${remaining.length} काम बाँकी छ।`}
            />
          )}
        </p>
      </div>

      {/* What is left, read from the shop rather than written down here. */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">
          <T en="Where things stand" ne="अहिलेको अवस्था" />
        </h2>
        <div className="space-y-3">
          {steps.map((step) => (
            <Link
              key={step.titleEn}
              href={step.href}
              className={`group flex items-start gap-4 rounded-lg border p-4 transition hover:shadow-md ${
                step.done ? "border-brand-green-line bg-brand-paper" : "border-amber-300 bg-amber-50"
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
                <p className="font-bold text-brand-green-ink group-hover:text-brand-green">
                  <T en={step.titleEn} ne={step.titleNe} />
                </p>
                <p className="text-sm text-brand-muted">
                  <T en={step.detailEn} ne={step.detailNe} />
                </p>
                <p className={`mt-1 text-xs font-bold ${step.done ? "text-brand-green" : "text-amber-700"}`}>
                  <T en={step.statusEn} ne={step.statusNe} />
                </p>
              </div>
              <span className="text-brand-muted-soft group-hover:text-brand-green">→</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">
          <T en="Things to learn" ne="सिक्ने कुरा" />
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {guides.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="group rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm transition hover:border-brand-green hover:shadow-md"
            >
              <div className="mb-2 text-3xl">{guide.icon}</div>
              <h3 className="font-bold text-brand-green-ink group-hover:text-brand-green">
                <T en={guide.titleEn} ne={guide.titleNe} />
              </h3>
              <p className="mt-1 text-xs text-brand-muted">
                <T en={guide.descriptionEn} ne={guide.descriptionNe} />
              </p>
              <p className="mt-2 text-xs font-semibold text-brand-muted">
                <T en={guide.timeEn} ne={guide.timeNe} />
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">
          <T en="What is where" ne="कुन काम कहाँ छ" />
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((category) => (
            <div key={category.categoryEn} className="rounded-lg border border-brand-green-line bg-brand-paper p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-brand-green-ink">
                <span className="text-xl">{category.icon}</span>
                <T en={category.categoryEn} ne={category.categoryNe} />
              </h3>
              <ul className="space-y-2">
                {category.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="text-xs font-bold text-brand-green-ink hover:text-brand-green">
                      {item.name}
                    </Link>
                    <p className="text-xs text-brand-muted">
                      <T en={item.descEn} ne={item.descNe} />
                    </p>
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
