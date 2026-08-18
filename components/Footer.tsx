import Link from "next/link";
import { businessContact, businessSocialProfiles } from "@/lib/seo";
import T from "@/components/T";

export default function Footer() {
  const socials = businessSocialProfiles();

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
          <h3 className="mb-4 text-xl font-bold"><T en="Quick Links" ne="छिटो जाने" /></h3>

          <ul className="space-y-2 text-gray-300">
            <li><Link href="/" className="hover:text-white"><T en="Home" ne="गृह पृष्ठ" /></Link></li>
            <li><Link href="/shop" className="hover:text-white"><T en="Shop" ne="पसल" /></Link></li>
            <li><Link href="/about" className="hover:text-white"><T en="Our Story" ne="हाम्रो कथा" /></Link></li>
            <li><Link href="/contact" className="hover:text-white"><T en="Contact" ne="सम्पर्क" /></Link></li>
            <li><Link href="/wholesale" className="hover:text-white"><T en="Wholesale" ne="थोक बिक्री" /></Link></li>
            <li><Link href="/track-order" className="hover:text-white"><T en="Track your order" ne="अर्डर कहाँ पुग्यो" /></Link></li>
            <li><Link href="/faq" className="hover:text-white"><T en="FAQ" ne="प्रश्न उत्तर" /></Link></li>
            <li><Link href="/return-policy" className="hover:text-white"><T en="Return Policy" ne="साट्ने नियम" /></Link></li>
            <li><Link href="/privacy" className="hover:text-white"><T en="Privacy" ne="गोपनीयता" /></Link></li>
            <li><Link href="/terms" className="hover:text-white"><T en="Terms" ne="सर्तहरू" /></Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold"><T en="Categories" ne="किसिम" /></h3>

          <ul className="space-y-2 text-gray-300">
            <li><Link href="/shop/ladies-sandals" className="hover:text-white"><T en="Ladies Sandals" ne="महिला सेन्डिल" /></Link></li>
            <li><Link href="/shop/ladies-slippers" className="hover:text-white"><T en="Ladies Slippers" ne="महिला चप्पल" /></Link></li>
            <li><Link href="/shop/casual-shoes" className="hover:text-white"><T en="Casual Shoes" ne="दैनिक जुत्ता" /></Link></li>
            <li><Link href="/shop/party-heels" className="hover:text-white"><T en="Party Heels" ne="पार्टी हिल" /></Link></li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold"><T en="Contact" ne="सम्पर्क" /></h3>

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
              {socials.map((profile) => (
                <a
                  key={profile.label}
                  href={profile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/30 px-3 py-1 text-sm text-gray-200 transition hover:border-brand-gold hover:text-white"
                >
                  {profile.label}
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
