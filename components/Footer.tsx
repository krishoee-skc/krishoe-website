import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0B4D3B] pb-8 pt-16 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 md:grid-cols-4">
        <div>
          <h2 className="text-3xl font-bold text-[#C8A04D]">KRISHOE</h2>

          <p className="mt-4 text-gray-300">
            Premium Footwear Crafted for Nepal. Style, Comfort & Quality in every step.
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xl font-bold">Quick Links</h3>

          <ul className="space-y-2 text-gray-300">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li><Link href="/shop" className="hover:text-white">Shop</Link></li>
            <li><Link href="/about" className="hover:text-white">About</Link></li>
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

          <p className="text-gray-300">Narayangadh, Chitwan</p>
          <p className="mt-2 text-gray-300">+977-98XXXXXXXX</p>
          <p className="mt-2 text-gray-300">hello@krishoe.com</p>
        </div>
      </div>

      <div className="mt-12 border-t border-white/20 pt-6 text-center text-gray-300">
        (c) 2026 KRISHOE. All Rights Reserved.
      </div>
    </footer>
  );
}
