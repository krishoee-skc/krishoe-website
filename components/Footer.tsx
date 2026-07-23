import Link from "next/link";
import { businessContact, businessSocialLinks } from "@/lib/seo";

const socialLabels: Record<string, string> = {
  [businessContact.facebook]: "Facebook",
  [businessContact.instagram]: "Instagram",
  [businessContact.tiktok]: "TikTok",
};

export default function Footer() {
  const socials = businessSocialLinks();

  return (
    <footer className="bg-brand-green pb-8 pt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-4">
        <div>
          <h2 className="text-3xl font-bold text-brand-gold">KRISHOE</h2>

          <p className="mt-4 text-gray-300">
            Premium Footwear Crafted for Nepal. Style, Comfort & Quality in every step.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold">Quick Links</h3>

          <ul className="space-y-2 text-gray-300">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li><Link href="/shop" className="hover:text-white">Shop</Link></li>
            <li><Link href="/about" className="hover:text-white">Our Story</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
            <li><Link href="/return-policy" className="hover:text-white">Return Policy</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold">Categories</h3>

          <ul className="space-y-2 text-gray-300">
            <li><Link href="/shop/ladies-sandals" className="hover:text-white">Ladies Sandals</Link></li>
            <li><Link href="/shop/ladies-slippers" className="hover:text-white">Ladies Slippers</Link></li>
            <li><Link href="/shop/casual-shoes" className="hover:text-white">Casual Shoes</Link></li>
            <li><Link href="/shop/party-heels" className="hover:text-white">Party Heels</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold">Contact</h3>

          <p className="text-gray-300">
            {businessContact.streetAddress}, {businessContact.addressLocality},{" "}
            {businessContact.addressRegion}
          </p>
          <p className="mt-2">
            <a href={`tel:${businessContact.phoneTel}`} className="text-gray-300 hover:text-white">
              {businessContact.phoneDisplay}
            </a>
          </p>
          <p className="mt-2">
            <a
              href={`https://wa.me/${businessContact.whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="text-gray-300 hover:text-white"
            >
              WhatsApp: {businessContact.whatsappDisplay}
            </a>
          </p>
          <p className="mt-2">
            <a href={`mailto:${businessContact.email}`} className="text-gray-300 hover:text-white">
              {businessContact.email}
            </a>
          </p>

          {socials.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {socials.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/30 px-3 py-1 text-sm text-gray-200 transition hover:border-brand-gold hover:text-white"
                >
                  {socialLabels[url] ?? "Follow"}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-12 border-t border-white/20 pt-6 text-center text-gray-300">
        (c) 2026 KRISHOE ({businessContact.addressLocality}, {businessContact.addressRegion}). All
        Rights Reserved.
      </div>
    </footer>
  );
}
