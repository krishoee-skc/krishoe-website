import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import T from "@/components/T";
import { getGuide, guides } from "@/lib/guides";
import { absoluteUrl, siteConfig } from "@/lib/seo";
import { createPageMetadata } from "@/lib/seo";

// Static params so each guide is a real, cacheable page a crawler can reach.
export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    return createPageMetadata({
      title: "Guide not found",
      description: "This guide could not be found.",
      path: `/guides/${slug}`,
    });
  }

  return createPageMetadata({
    title: guide.title.en,
    description: guide.description.en,
    path: `/guides/${guide.slug}`,
  });
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  const url = absoluteUrl(`/guides/${guide.slug}`);

  // Article structured data: lets Google show this as a guide with a title,
  // date and publisher rather than a bare blue link.
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title.en,
    description: guide.description.en,
    datePublished: guide.published,
    dateModified: guide.updated,
    inLanguage: "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: absoluteUrl(siteConfig.defaultImagePath),
    author: { "@type": "Organization", name: siteConfig.name, url: absoluteUrl("/") },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: { "@type": "ImageObject", url: absoluteUrl(siteConfig.defaultImagePath) },
    },
  };

  return (
    <main className="bg-brand-paper">
      <Navbar />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <article className="mx-auto max-w-3xl px-5 py-12 md:px-8 md:py-16">
        <Link
          href="/guides"
          className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-gold-deep transition hover:text-brand-green"
        >
          ← <T en="All guides" ne="सबै guide" />
        </Link>

        <div className="mt-5 text-5xl" aria-hidden>
          {guide.emoji}
        </div>
        <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight text-brand-green-ink md:text-4xl">
          <T en={guide.title.en} ne={guide.title.ne} />
        </h1>
        <p className="mt-4 text-lg leading-8 text-brand-muted">
          <T en={guide.intro.en} ne={guide.intro.ne} />
        </p>

        <div className="mt-10 space-y-9">
          {guide.blocks.map((block) => (
            <section key={block.heading.en}>
              <h2 className="text-xl font-black text-brand-green-ink">
                <T en={block.heading.en} ne={block.heading.ne} />
              </h2>
              {block.body.map((paragraph, index) => (
                <p key={index} className="mt-3 text-base leading-8 text-brand-muted">
                  <T en={paragraph.en} ne={paragraph.ne} />
                </p>
              ))}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-brand-gold/40 bg-brand-mist p-7 text-center">
          <p className="text-base font-bold text-brand-green-ink">
            <T
              en="Ready to find your pair?"
              ne="आफ्नो जोडी भेट्टाउन तयार हुनुहुन्छ?"
            />
          </p>
          <Link
            href={guide.ctaHref}
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-brand-green-ink px-7 py-3 text-sm font-black text-white transition hover:bg-brand-green"
          >
            <T en={guide.ctaLabel.en} ne={guide.ctaLabel.ne} />
          </Link>
        </div>
      </article>

      <Footer />
    </main>
  );
}
