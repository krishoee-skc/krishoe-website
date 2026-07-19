import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KRISHOE Footwear",
    short_name: "KRISHOE",
    description: "Premium footwear catalog, wishlist, cart, and order requests for KRISHOE.",
    start_url: "/",
    // Opens without the browser's address bar, so an installed KRISHOE looks
    // like an app rather than a bookmarked page.
    display: "standalone",
    background_color: "#F5F7F4",
    theme_color: "#10231D",
    orientation: "portrait",
    categories: ["shopping", "business"],
    icons: [
      // Android refuses to offer "Install app" unless the manifest carries a
      // 192px and a 512px PNG. This listed only favicon.ico, so the site could
      // be bookmarked but never installed — the reason there was no app to put
      // on the home screen.
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Cropped to a circle or a squircle depending on the phone, so this one
      // carries a wider margin than the others need.
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
    // Long-pressing the installed icon jumps straight to these.
    shortcuts: [
      { name: "Shop", short_name: "Shop", url: "/shop" },
      { name: "Cart", short_name: "Cart", url: "/cart" },
      { name: "Admin", short_name: "Admin", url: "/admin" },
    ],
  };
}
