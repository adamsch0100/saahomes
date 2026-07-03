/**
 * Google Business Profile Reviews — dynamically updated.
 *
 * These are manually curated from verified Google reviews.
 * When the GBP API is fully configured, scripts/fetch-google-reviews.py
 * will auto-update src/data/reviews.json and this file will import from it.
 */

export const reviews = [
  {
    name: "Andy Witt",
    text: "Adam and Mandi were absolutely phenomenal! Would definitely recommend them if you're a first time buyer. Walked me through every step of the process and constantly checked in! You should definitely give them a shout if you're thinking of purchasing a home!",
    rating: 5,
    date: "2024-06-01",
    source: "Google",
  },
  {
    name: "Kevin Freestone",
    text: "The right people to help you get a home. Very responsive, respectful, and professional.",
    rating: 5,
    date: "2024-05-15",
    source: "Google",
  },
  {
    name: "Josh Sorensen",
    text: "Adam is friendly, professional and easy to talk to. I highly recommend Adam if you're selling/buying your home. You won't be disappointed!",
    rating: 5,
    date: "2024-04-20",
    source: "Google",
  },
  {
    name: "Daen Manriquez",
    text: "Adam is a pleasure to work with. His friendly demeanor and dedication to client satisfaction set him apart. Adam's outstanding service made the home-buying experience a positive one!",
    rating: 5,
    date: "2024-03-10",
    source: "Google",
  },
  {
    name: "Kylie Graff",
    text: "My husband and I just bought our first home, and couldn't have done it without the knowledge and guidance from the Schwartz team. They were always available to answer any questions.",
    rating: 5,
    date: "2024-02-28",
    source: "Google",
  },
  {
    name: "Ana Ssenz",
    text: "Very honest and trustworthy agents. Made our home buying experience smooth and stress-free.",
    rating: 5,
    date: "2024-01-15",
    source: "Google",
  },
]

export const reviewStats = {
  count: reviews.length,
  averageRating: "5.0",
  maxRating: 5,
  source: "Google Business Profile",
  profileUrl: "https://search.google.com/local/reviews?placeid=ChIJpyBmbdyN7h4R3q0_0424B0Q",
}

export function getReviewSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: "Schwartz and Associates",
    url: "https://saahomes.com",
    telephone: "(970) 999-1407",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: reviewStats.averageRating,
      reviewCount: reviewStats.count.toString(),
      bestRating: "5",
      worstRating: "1",
    },
    review: reviews.slice(0, 20).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating.toString(),
        bestRating: "5",
        worstRating: "1",
      },
      reviewBody: r.text,
      datePublished: r.date,
    })),
  }
}
