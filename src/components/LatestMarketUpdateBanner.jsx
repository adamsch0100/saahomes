import React from "react";
import { Link } from "react-router-dom";
import { getLatestMarketUpdatePost } from "../data/blogPosts";

export default function LatestMarketUpdateBanner({ variant = "default", cityName = null }) {
  const post = getLatestMarketUpdatePost();
  if (!post) return null;

  const href = `/blog/${post.slug}/`;
  const headline = cityName
    ? `${cityName} & Northern Colorado market update`
    : "Latest Northern Colorado market update";

  if (variant === "compact") {
    return (
      <div className="my-6 p-5 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-800 mb-1">Market intelligence</p>
        <Link to={href} className="font-bold font-serif text-lg text-gray-900 hover:underline">
          {post.title} →
        </Link>
        <p className="text-sm text-gray-600 mt-2">{post.excerpt}</p>
      </div>
    );
  }

  return (
    <section className="w-full bg-white py-12 border-y border-gray-100">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <div className="rounded-2xl overflow-hidden shadow-lg grid md:grid-cols-2 bg-gray-900 text-white">
          <div
            className="min-h-[200px] bg-cover bg-center"
            style={{ backgroundImage: `url('${post.image}')` }}
            aria-hidden="true"
          />
          <div className="p-8 flex flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#CFB36E] mb-2">{headline}</p>
            <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3">{post.title}</h2>
            <p className="text-gray-300 mb-6 leading-relaxed">{post.excerpt}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                to={href}
                className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Read the market update
              </Link>
              <Link
                to="/for-sellers/"
                className="inline-flex items-center justify-center px-6 py-3 border-2 border-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
              >
                Get a free market report
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
