import type { Metadata } from "next";
import NarayangadhPage from "@/app/narayangadh/page";
import { createPageMetadata } from "@/lib/seo";
import { narayangadhCopy } from "@/lib/local-pages";

export const metadata: Metadata = createPageMetadata({
  title: narayangadhCopy.ne.title,
  description: narayangadhCopy.ne.description,
  path: "/ne/narayangadh",
  language: "ne",
  pairPath: "/narayangadh",
});

/** The page for people nearby, in Nepali — see app/ne/layout.tsx. */
export default NarayangadhPage;
