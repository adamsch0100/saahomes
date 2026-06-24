import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { blogPosts } from "../data/blogPosts";

export default function BlogPage() {
  return (
    <>
      <SEO
        exactTitle="Northern Colorado Real Estate Blog & Guides | Colorado Home Tips | SAA Homes"
        description="Northern Colorado real estate blog with market updates, home buying and selling tips, and neighborhood guides for Fort Collins, Loveland, Windsor, Greeley, and across Colorado."
        keywords="Northern Colorado real estate blog, Colorado home buying tips, Fort Collins housing market, Northern Colorado market update, Colorado seller tips, SAA Homes guides"
        canonical="https://saahomes.com/blog/"
        jsonLd={[{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "SAA Homes Northern Colorado Real Estate Blog",
          url: "https://saahomes.com/blog/",
          description: "Real estate tips, market updates, and guides for Northern Colorado home buyers and sellers.",
          publisher: {
            "@type": "Organization",
            name: "Schwartz And Associates",
            url: "https://saahomes.com/",
          },
          blogPost: blogPosts.map((post) => ({
            "@type": "BlogPosting",
            headline: post.title,
            url: `https://saahomes.com/blog/${post.slug}/`,
            datePublished: post.date,
          })),
        }]}
      />

      <section className="relative h-80 bg-gray-900 flex items-center justify-center pt-24">
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-5xl sm:text-6xl font-bold">Real Estate Blog</h1>
          <p className="mt-4 text-xl text-gray-300">Tips, market updates, and guides for Northern Colorado</p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map((post) => (
              <article key={post.slug} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <Link to={`/blog/${post.slug}/`}>
                  <div
                    className="h-48 bg-cover bg-center"
                    style={{ backgroundImage: `url('${post.image}')` }}
                  />
                </Link>
                <div className="p-6">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{post.category}</span>
                  <h2 className="text-xl font-bold mt-2 mb-3 text-gray-900">
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
            <h2 className="text-3xl font-bold mb-4">Have a Northern Colorado real estate question?</h2>
            <p className="text-gray-600 mb-6 max-w-xl mx-auto">
              We publish guides regularly, but nothing beats a conversation about your specific goals.
            </p>
            <Link to="/contact/" className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
              Contact SAA Homes
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
