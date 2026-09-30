import type { Metadata } from "next";
import Home from "@/app/page";
import { createPageMetadata } from "@/lib/seo";
import { nepaliHome } from "@/lib/nepali-pages";

export const metadata: Metadata = createPageMetadata({
  title: nepaliHome.title,
  description: nepaliHome.description,
  path: "/ne",
  language: "ne",
  pairPath: "/",
});

/** The home page, in Nepali — see app/ne/layout.tsx. */
export default Home;
