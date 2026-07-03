import React from "react";
import { Helmet } from "react-helmet-async";
import SEO from "../components/SEO";
import { BUSINESS } from "../utils/seoConstants.js";
import { reviews, reviewStats, getReviewSchema } from "../data/reviews.js";

const reviewSchema = getReviewSchema();

export default function TestimonialsPage() {
  return (
    <>
      <SEO
        exactTitle="Client Reviews | SAA Homes Fort Collins Real Estate"
        description="Read client reviews for SAA Homes — Fort Collins real estate agents Adam and Mandi Schwartz. See why buyers and sellers across Northern Colorado trust Schwartz and Associates."
        keywords="SAA Homes reviews, Schwartz and Associates testimonials, Fort Collins realtor reviews, Adam Schwartz reviews, Northern Colorado real estate client reviews"
        canonical="https://saahomes.com/testimonials/"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(reviewSchema)}</script>
      </Helmet>

      {/* Hero */}
      <section className="relative h-80 bg-gray-900 flex items-center justify-center pt-24">
        <div className="relative z-10 text-center text-white px-6">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold">Client Reviews</h1>
          <p className="mt-4 text-xl text-gray-300">What our clients say about working with SAA Homes</p>
        </div>
      </section>

      {/* Reviews Grid */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-8 h-8 text-yellow-400 fill-current" viewBox="0 0 20 20">
                  <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                </svg>
              ))}
            </div>
            <p className="text-2xl font-bold text-gray-900">5.0 out of 5 — {reviews.length} reviews</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {reviews.map((review, idx) => (
              <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
                <div className="flex items-center mb-4">
                  <div className="flex">
                    {[...Array(review.rating)].map((_, i) => (
                      <svg key={i} className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-gray-700 text-base mb-4 leading-relaxed">
                  "{review.text}"
                </p>
                <p className="font-semibold text-gray-900">— {review.name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Ready to work with SAA Homes?</h2>
          <p className="text-xl mb-8">
            Join hundreds of satisfied clients across Northern Colorado.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a href="/contact/" className="inline-block px-8 py-3 bg-white text-black font-semibold rounded hover:bg-gray-100 transition-colors">
              Contact Us
            </a>
            <a href="/for-buyers/" className="inline-block px-8 py-3 border-2 border-white text-white font-semibold rounded hover:bg-white hover:text-black transition-colors">
              Search Homes
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
