import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import ChfaResourceHub from "../components/ChfaResourceHub";
import { blogPosts } from "../data/blogPosts";

const sortedPosts = [...blogPosts].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

const chfaPosts = sortedPosts.filter((post) => post.category?.includes("CHFA"));

export default function BlogPage() {
  return (
    <>
      <SEO
        exactTitle="Northern Colorado Real Estate Blog & CHFA Homebuyer Guides | SAA Homes"
        description="Northern Colorado real estate blog with CHFA down payment assistance guides, market updates, and home buying tips for Fort Collins, Loveland, Windsor, Greeley, and across Colorado."
        keywords="Northern Colorado real estate blog, CHFA down payment assistance guide, Colorado first time home buyer, Fort Collins housing market, CHFA Fort Collins, educator home loan Colorado, SAA Homes guides"
        canonical="https://saahomes.com/blog/"
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "SAA Homes Northern Colorado Real Estate Blog",
          url: "https://saahomes.com/blog/",
          description: "Real estate tips, CHFA homebuyer guides, market updates, and neighborhood guides for Northern Colorado.",
          publisher: {
            "@type": "Organization",
            name: "Schwartz And Associates",
            url: "https://saahomes.com/",
          },
          blogPost: sortedPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: `https://saahomes.com/blog/${post.slug}/`,
            datePublished: post.date,
          })),
        }]}
      />

      <section className="relative h-80 bg-gray-900 flex items-center justify-center pt-24">
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-serif">Real Estate Guides</h1>
          <p className="mt-4 text-xl text-gray-300">CHFA programs, market updates, and Northern Colorado buyer and seller tips</p>
        </div>
      </section>

      {chfaPosts.length > 0 && (
        <section className="py-12 px-6 bg-black text-white">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm font-semibold uppercase tracking-widest mb-2 text-center" style={{ color: "#CFB36E" }}>
              Featured CHFA Guides
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-center mb-8">
              Colorado down payment assistance resources
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {chfaPosts.map((post) => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}/`}
                  className="block p-5 rounded-xl border border-gray-700 bg-gray-900/50 hover:border-[#CFB36E] transition-colors"
                >
                  <span className="text-xs text-gray-400">{post.readTime}</span>
                  <h3 className="font-bold font-serif mt-2 text-sm leading-snug hover:underline">{post.title}</h3>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link
                to="/chfa-down-payment-assistance/"
                className="inline-flex items-center px-6 py-3 rounded-lg font-semibold"
                style={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
              >
                View all CHFA programs →
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {sortedPosts.map((post) => (
              <article key={post.slug} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <Link to={`/blog/${post.slug}/`}>
                  <div
                    className="h-48 bg-cover bg-center"
                    style={{ backgroundImage: `url('${post.image}')` }}
                  />
                </Link>
                <div className="p-6">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${post.category?.includes("CHFA") ? "text-[#8B7355]" : "text-blue-600"}`}>
                    {post.category}
                  </span>
                  <h2 className="text-xl font-bold mt-2 mb-3 text-gray-900 font-serif">
                    <Link to={`/blog/${post.slug}/`} className="hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <time className="text-xs text-gray-400" dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </time>
                    <Link to={`/blog/${post.slug}/`} className="text-sm font-semibold text-black hover:underline">
                      Read guide →
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-16 p-12 bg-gray-50 rounded-xl">
            <h2 className="text-3xl font-bold font-serif mb-4">Have a Northern Colorado real estate question?</h2>
            <p className="text-gray-600 mb-6 max-w-xl mx-auto">
              We publish guides regularly, but nothing beats a conversation about your specific goals — especially when CHFA programs are involved.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/chfa-down-payment-assistance/#chfa-dpa-lead-form" className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
                Free CHFA Consultation
              </Link>
              <Link to="/contact/" className="inline-block px-8 py-3 border-2 border-black text-black font-semibold rounded hover:bg-black hover:text-white transition-colors">
                Contact SAA Homes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ChfaResourceHub />
    </>
  );
}
