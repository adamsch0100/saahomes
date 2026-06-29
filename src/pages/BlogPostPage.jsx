import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import SEO from "../components/SEO";
import MarketReportForm from "../components/MarketReportForm";
import ChfaResourceHub from "../components/ChfaResourceHub";
import { blogPosts, getBlogPost, getBlogPostUrl } from "../data/blogPosts";
import { BUSINESS } from "../utils/seoConstants";

function RelatedLinksBox({ links, title = "Related resources" }) {
  if (!links?.length) return null;

  return (
    <div className="my-8 p-6 bg-amber-50 border border-amber-100 rounded-xl">
      <h3 className="font-bold font-serif text-lg mb-4">{title}</h3>
      <ul className="space-y-4">
        {links.map((link) => (
          <li key={link.href}>
            <Link to={link.href} className="font-semibold text-gray-900 hover:underline">
              {link.title} →
            </Link>
            {link.description && (
              <p className="text-sm text-gray-600 mt-1">{link.description}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getBlogPost(slug);

  if (!post) {
    return <Navigate to="/blog/" replace />;
  }

  const canonical = getBlogPostUrl(post.slug);
  const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isChfaPost = post.category?.includes("CHFA");
  const supersededPost = post.supersededBy ? getBlogPost(post.supersededBy) : null;

  const relatedPosts = blogPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: `https://saahomes.com${post.image}`,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      "@type": "Organization",
      name: BUSINESS.name,
      url: BUSINESS.url,
    },
    publisher: {
      "@type": "Organization",
      name: BUSINESS.name,
      url: BUSINESS.url,
      logo: {
        "@type": "ImageObject",
        url: BUSINESS.logo,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    articleSection: post.category,
    keywords: post.keywords,
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://saahomes.com/" },
      { "@type": "ListItem", position: 2, name: "Colorado Real Estate Guides", item: "https://saahomes.com/blog/" },
      { "@type": "ListItem", position: 3, name: post.title, item: canonical },
    ],
  };

  const faqSchema = post.faqs?.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: post.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      }
    : null;

  const jsonLd = [articleSchema, breadcrumbSchema, ...(faqSchema ? [faqSchema] : [])];

  const cta = post.cta || {
    title: "Ready for personalized guidance?",
    description: "Adam and Mandi Schwartz help buyers and sellers across Northern Colorado. Tell us what you are looking for and we will follow up quickly.",
    primaryHref: "/contact/",
    primaryText: "Contact SAA Homes",
    secondaryHref: "/properties/",
    secondaryText: "Search Homes",
  };

  return (
    <>
      <SEO
        exactTitle={`${post.title} | SAA Homes`}
        description={post.excerpt}
        keywords={post.keywords || `${post.category}, Northern Colorado real estate, Colorado home buying, Fort Collins real estate, SAA Homes blog`}
        canonical={canonical}
        ogImage={`https://saahomes.com${post.image}`}
        ogUrl={canonical}
        type="article"
        jsonLd={jsonLd}
      />

      <article className="pb-16">
        <section
          className="relative min-h-[360px] sm:min-h-[420px] bg-cover bg-center flex items-end pt-28 sm:pt-32 pb-10 sm:pb-12"
          style={{ backgroundImage: `url('${post.image}')` }}
        >
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 max-w-4xl mx-auto px-6 text-white w-full">
            <Link to="/blog/" className="text-sm text-gray-200 hover:text-white mb-4 inline-block">
              ← Back to Real Estate Guides
            </Link>
            <span className="block text-sm font-semibold uppercase tracking-wide text-[#CFB36E] mb-3">
              {post.category}
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif leading-tight">{post.title}</h1>
            <p className="mt-4 text-gray-200">
              {formattedDate} · {post.readTime}
            </p>
          </div>
        </section>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {supersededPost && (
            <div className="mb-8 p-5 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 mb-2">Updated report available</p>
              <p className="text-gray-700 mb-3">
                This article was published {formattedDate}. For current Northern Colorado market data, read our latest update.
              </p>
              <Link
                to={`/blog/${supersededPost.slug}/`}
                className="font-bold font-serif text-gray-900 hover:underline"
              >
                {supersededPost.title} →
              </Link>
            </div>
          )}

          <p className="text-xl text-gray-700 leading-relaxed mb-10">{post.excerpt}</p>

          {post.relatedLinks && <RelatedLinksBox links={post.relatedLinks} title="Jump to program guides" />}

          {post.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-lg text-gray-700 leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-4">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {section.relatedLinks && (
                <RelatedLinksBox links={section.relatedLinks} title="Helpful links" />
              )}
            </section>
          ))}

          {post.faqs && (
            <section className="mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6">Quick answers</h2>
              <div className="space-y-4">
                {post.faqs.map((faq) => (
                  <div key={faq.q} className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <h3 className="font-bold font-serif mb-2">{faq.q}</h3>
                    <p className="text-gray-700 leading-relaxed">{faq.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="mt-12 p-8 bg-gray-50 rounded-xl border border-gray-100">
            <h2 className="text-2xl font-bold font-serif mb-3">{cta.title}</h2>
            <p className="text-gray-700 mb-6">{cta.description}</p>
            <div className="flex flex-wrap gap-4">
              <Link
                to={cta.primaryHref}
                className="inline-block px-6 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors"
              >
                {cta.primaryText}
              </Link>
              {cta.secondaryHref && (
                <Link
                  to={cta.secondaryHref}
                  className="inline-block px-6 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors"
                >
                  {cta.secondaryText}
                </Link>
              )}
            </div>
          </div>

          {relatedPosts.length > 0 && (
            <section className="mt-12 pt-8 border-t border-gray-200">
              <h2 className="text-xl font-bold font-serif mb-4">More in {post.category}</h2>
              <ul className="space-y-3">
                {relatedPosts.map((related) => (
                  <li key={related.slug}>
                    <Link to={`/blog/${related.slug}/`} className="font-semibold hover:underline">
                      {related.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {isChfaPost && <ChfaResourceHub />}

        <section className="py-16 px-6 bg-gray-50">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold font-serif mb-4 text-center">Get a free Northern Colorado market report</h2>
            <p className="text-center text-gray-600 mb-8">
              See what homes are selling for in your target area.
            </p>
            <MarketReportForm areaName="Northern Colorado" />
          </div>
        </section>
      </article>
    </>
  );
}
