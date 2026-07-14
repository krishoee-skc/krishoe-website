import type { Metadata } from "next";
import type { Product } from "@/lib/products";
import {
  itemListJsonLd,
  localBusinessJsonLd,
  organizationJsonLd,
  siteConfig,
  websiteJsonLd,
} from "@/lib/seo";

type StructuredDataProps = {
  metadata: Metadata;
  products: Product[];
};

function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function JsonLdScript({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json">
      {jsonLd(data)}
    </script>
  );
}

export function StructuredData({ metadata, products }: StructuredDataProps) {
  const title = typeof metadata.title === "string" ? metadata.title : "KRISHOE";
  const description =
    typeof metadata.description === "string" ? metadata.description : siteConfig.description;
  const activeProducts = products.filter((product) => product.status === "Active").slice(0, 24);
  const graph = [
    organizationJsonLd(),
    localBusinessJsonLd(),
    websiteJsonLd(description),
    itemListJsonLd({
      name: `${title} product catalog`,
      url: "/shop",
      products: activeProducts,
    }),
  ];

  return (
    <>
      {graph.map((item, index) => (
        <JsonLdScript key={index} data={item} />
      ))}
    </>
  );
}
