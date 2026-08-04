import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Getting Started | KRISHOE Admin",
};

export default function GettingStartedPage() {
  const quickLinks = [
    {
      icon: "📸",
      title: "Product Photography Guide",
      description: "Learn how to take professional product photos using just your phone",
      href: "/admin/products/photo-guide",
      time: "5 min read",
    },
    {
      icon: "📦",
      title: "Upload Products",
      description: "Add your first products to the catalog with descriptions and pricing",
      href: "/admin/products",
      time: "15 min",
    },
    {
      icon: "💰",
      title: "Configure Payments",
      description: "Set up payment gateways (eSewa, Khalti) for customer orders",
      href: "/admin/settings",
      time: "10 min",
    },
    {
      icon: "⭐",
      title: "Review Moderation",
      description: "Manage and approve customer reviews for your storefront",
      href: "/admin/reviews",
      time: "Ongoing",
    },
  ];

  const features = [
    {
      category: "Sales & Orders",
      icon: "🛒",
      items: [
        { name: "Orders", href: "/admin/orders", desc: "View and manage customer orders" },
        { name: "POS", href: "/admin/pos", desc: "In-store sales entry & billing" },
        { name: "Payments", href: "/admin/payments", desc: "Payment reconciliation & tracking" },
      ],
    },
    {
      category: "Products",
      icon: "👟",
      items: [
        { name: "Products", href: "/admin/products", desc: "Manage catalog and inventory" },
        { name: "Stock", href: "/admin/stock", desc: "Real-time stock levels by size" },
        { name: "Photo Guide", href: "/admin/products/photo-guide", desc: "Photography tips & tricks" },
      ],
    },
    {
      category: "Operations",
      icon: "⚙️",
      items: [
        { name: "Operations", href: "/admin/operations", desc: "Production tracking & ledgers" },
        { name: "Factory", href: "/admin/factory", desc: "Worker management & payroll" },
        { name: "Purchasing", href: "/admin/purchasing", desc: "Supplier & material management" },
      ],
    },
    {
      category: "People",
      icon: "👥",
      items: [
        { name: "HR", href: "/admin/hr", desc: "Employee records and payroll" },
        { name: "Customers", href: "/admin/customers", desc: "Customer management & history" },
        { name: "Devices", href: "/admin/devices", desc: "POS terminals and access" },
      ],
    },
    {
      category: "Business",
      icon: "📊",
      items: [
        { name: "Insights", href: "/admin/insights", desc: "Analytics and business metrics" },
        { name: "Costing", href: "/admin/costing", desc: "Design costing and margins" },
        { name: "Settings", href: "/admin/settings", desc: "Company info and configurations" },
      ],
    },
    {
      category: "Communication",
      icon: "💬",
      items: [
        { name: "Reviews", href: "/admin/reviews", desc: "Customer review moderation" },
        { name: "Messages", href: "/admin/messages", desc: "Contact form submissions" },
        { name: "Notifications", href: "/admin/notifications", desc: "Alerts and email setup" },
      ],
    },
  ];

  const keyboardShortcuts = [
    { key: "?", description: "Open keyboard shortcuts help" },
    { key: "G then D", description: "Go to Dashboard" },
    { key: "G then O", description: "Go to Orders" },
    { key: "G then P", description: "Go to Products" },
    { key: "K", description: "Search (Quick find)" },
    { key: "Esc", description: "Close modals/forms" },
  ];

  return (
    <section className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-brand-green-ink">🎉 स्वागत छ KRISHOE Admin मा!</h1>
        <p className="mt-2 max-w-3xl text-gray-600">
          तपाईंको online shop र factory management system तयार छ। यहाँ शुरु गर्नको लागि key features र tips छ।
        </p>
      </div>

      {/* Quick Start */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">🚀 जल्दी शुरु गर्नुहोस्</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-brand-green"
            >
              <div className="mb-2 text-3xl">{link.icon}</div>
              <h3 className="font-bold text-brand-green-ink group-hover:text-brand-green">{link.title}</h3>
              <p className="mt-1 text-xs text-gray-600">{link.description}</p>
              <p className="mt-2 text-xs font-semibold text-gray-500">⏱️ {link.time}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Complete Feature Map */}
      <section className="mb-8">
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">📍 पूरै Feature Map</h2>
        <p className="mb-4 text-sm text-gray-600">
          Admin dashboard मा सबै features कहाँ छ भन्ने जान्न यहाँ हेर्नुहोस्:
        </p>
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
                    <Link
                      href={item.href}
                      className="text-xs font-bold text-brand-green-ink hover:text-brand-green"
                    >
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

      {/* Keyboard Shortcuts */}
      <section className="mb-8 rounded-lg border border-brand-green/20 bg-brand-green-wash/30 p-6">
        <h2 className="mb-4 flex items-center gap-2 text-xl font-black text-brand-green-ink">
          <span>⌨️</span> Keyboard Shortcuts
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          तेजी को साथ काम गर्न यो shortcuts प्रयोग गर। अझ ढेर shortcut को लागि <kbd className="rounded bg-white px-2 py-1 font-mono text-xs font-bold">?</kbd> दबाऊ।
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {keyboardShortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center gap-3 rounded-lg border border-brand-green/20 bg-white p-3">
              <kbd className="rounded-md bg-gray-100 px-2 py-1 font-mono text-sm font-bold text-gray-700">
                {key}
              </kbd>
              <p className="text-sm text-gray-700">{description}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-600">
          <strong>टिप:</strong> अधिकांश pages मा जाने को लागि "G" दबाएर फेरी अक्षर दबाऊ (जस्तै "G then D" = Dashboard)
        </div>
      </section>

      {/* First Steps Checklist */}
      <section>
        <h2 className="mb-4 text-xl font-black text-brand-green-ink">✅ पहिलो हप्ताको Checklist</h2>
        <div className="space-y-3">
          {[
            {
              num: 1,
              task: "फोटो guide पढ्नु",
              details: "Product photography को basics सिक्नु",
              link: "/admin/products/photo-guide",
            },
            {
              num: 2,
              task: "पहिलो products upload गर्नु",
              details: "3-5 जुत्ताको photos र descriptions सहित",
              link: "/admin/products",
            },
            {
              num: 3,
              task: "Payment gateway configure गर्नु",
              details: "eSewa र Khalti को API keys add गर्नु",
              link: "/admin/settings",
            },
            {
              num: 4,
              task: "Company settings पूरा गर्नु",
              details: "Phone, address, social links add गर्नु",
              link: "/admin/settings",
            },
            {
              num: 5,
              task: "Email notifications setup गर्नु",
              details: "New orders को लागि email alert प्राप्त गर्नु",
              link: "/admin/notifications",
            },
          ].map((item) => (
            <Link
              key={item.num}
              href={item.link}
              className="group rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-green text-white font-bold">
                  {item.num}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-brand-green-ink group-hover:text-brand-green">{item.task}</p>
                  <p className="text-sm text-gray-600">{item.details}</p>
                </div>
                <span className="text-gray-400 group-hover:text-brand-green">→</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
