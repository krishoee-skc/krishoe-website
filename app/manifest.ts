import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KRISHOE Footwear",
    short_name: "KRISHOE",
    description: "Premium footwear catalog, wishlist, cart, and order requests for KRISHOE.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7F4",
    theme_color: "#10231D",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
