// Money-page FAQ data + FAQPage schema helper (restored 2026-08-09 — driver).
// The Cursor refactor (828dfcf) imported this module but never committed it,
// breaking the Railway build. Content is NOT new — it re-exports the real
// buyer/seller FAQ data that has been live since It 10.10 (b85fc92), keeping
// the FAQPage JSON-LD and visible FAQ sections intact. No fabricated data.

import { BUYER_FAQS, SELLER_FAQS } from "./buyerSellerFaqs.js";

/** Money-page buyer FAQs — same data that previously fed ForBuyersPage. */
export const FOR_BUYERS_FAQS = BUYER_FAQS;

/** Money-page seller FAQs — same data that previously fed ForSellersPage. */
export const FOR_SELLERS_FAQS = SELLER_FAQS;

/**
 * Build an FAQPage JSON-LD object for the money pages.
 * Returns null when the list is empty (callers filter(Boolean)).
 */
export function buildFaqPageSchema(faqs = []) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}
