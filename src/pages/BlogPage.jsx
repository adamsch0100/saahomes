import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

const posts = [
  {
    slug: "buying-a-home-in-fort-collins",
    title: "Your Complete Guide to Buying a Home in Fort Collins",
    excerpt: "Fort Collins is one of Colorado's most desirable cities. Here's everything you need to know about the buying process, neighborhoods, and what to expect in today's market.",
    date: "2025-03-15",
    category: "Buyer Tips"
  },
  {
    slug: "northern-colorado-market-update",
    title: "Northern Colorado Real Estate Market Update 2025",
    excerpt: "Get the latest insights on home prices, inventory, and market trends across Fort Collins, Loveland, Windsor, and Greeley for 2025.",
    date: "2025-02-28",
    category: "Market Update"
  },
  {
    slug: "how-to-sell-your-home-fast",
    title: "How to Sell Your Home Fast in Northern Colorado",
    excerpt: "Discover proven strategies to maximize your home's value and sell quickly, from staging tips to pricing it right from day one.",
    date: "2025-02-10",
    category: "Seller Tips"
  }
];

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
          "name": "SAA Homes Northern Colorado Real Estate Blog",
          "url": "https://saahomes.com/blog/",
          "description": "Real estate tips, market updates, and guides for Northern Colorado home buyers and sellers.",
          "publisher": {
            "@type": "Organization",
            "name": "Schwartz And Associates",
            "url": "https://saahomes.com/",
          },
        }]}
      />

      {/* Hero */}
      <section className="relative h-80 bg-gray-900 flex items-center justify-center pt-24">
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-5xl sm:text-6xl font-bold">Real Estate Blog</h1>
          <p className="mt-4 text-xl text-gray-300">Tips, market updates, and guides for Northern Colorado</p>
        </div>
      </section>

      {/* Posts Grid */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => (
              <article key={post.slug} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Coming Soon</span>
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">{post.category}</span>
                  <h2 className="text-xl font-bold mt-2 mb-3 text-gray-900">{post.title}</h2>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{post.excerpt}</p>
                  <div className="flex items-center justify-between">
                    <time className="text-xs text-gray-400" dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                    </time>
                    <a href="/contact/" className="text-sm font-semibold text-black hover:underline">
                      Ask us →
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-16 p-12 bg-gray-50 rounded-xl">
            <h2 className="text-3xl font-bold mb-4">More content coming soon</h2>
            <p className="text-gray-600 mb-6 max-w-xl mx-auto">
              We're building out our resource library with market reports, neighborhood guides, and expert advice for Northern Colorado buyers and sellers.
            </p>
            <a href="/contact/" className="inline-block px-8 py-3 bg-black text-white font-semibold rounded hover:bg-gray-800 transition-colors">
              Have a question? Contact us
            </a>
          </div>
        </div>
      </section>

      {/* Topics */}
      <section className="py-16 px-6 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10">Explore Topics</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            {["Buyer Tips", "Seller Tips", "Market Updates", "Neighborhood Guides", "Fort Collins", "Loveland", "Windsor", "Mortgage Tips"].map((topic) => (
              <span key={topic} className="px-5 py-2 bg-gray-800 rounded-full text-sm font-medium hover:bg-gray-700 transition-colors cursor-default">
                {topic}
              </span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
