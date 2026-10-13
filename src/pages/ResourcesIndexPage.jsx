import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import {
  RESOURCES_URL,
  RESOURCES_TITLE,
  RESOURCES_DESCRIPTION,
  RESOURCE_PAGES,
} from "../data/resourcesIndex.js";
import { CITATION_PUBLISHER } from "../utils/citation.js";

const GOLD = "#CFB36E";

export default function ResourcesIndexPage() {
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Northern Colorado Housing Data & Statistics",
    url: RESOURCES_URL,
    description: RESOURCES_DESCRIPTION,
    hasPart: RESOURCE_PAGES.map((p) => ({
      "@type": "WebPage",
      name: p.title,
      url: `https://saahomes.com${p.path}`,
      dateModified: p.updated,
    })),
  };

  return (
    <>
      <SEO
        exactTitle={RESOURCES_TITLE}
        description={RESOURCES_DESCRIPTION}
        canonical={RESOURCES_URL}
        ogTitle="Northern Colorado Housing Data & Statistics — Sourced & Dated"
        ogDescription={RESOURCES_DESCRIPTION}
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        ogUrl={RESOURCES_URL}
        jsonLd={[collectionSchema]}
      />

      <section className="relative bg-black text-white pt-28 sm:pt-32 pb-16 sm:pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Resources
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight">
            Northern Colorado Housing Data &amp; Statistics
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl leading-relaxed">
            Sourced, dated housing numbers for journalists, lenders, educators and
            buyers. Every figure links to its primary source and shows the date it
            was verified, and every stat has a ready-made citation you can copy.
          </p>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          {RESOURCE_PAGES.map((page) => (
            <Link
              key={page.path}
              to={page.path}
              className="block bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:border-black transition-colors"
            >
              <h2 className="text-xl font-bold font-serif mb-3">{page.title}</h2>
              <p className="text-sm text-gray-700 leading-relaxed mb-4">{page.description}</p>
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                Updated {page.updated}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="py-12 px-6 bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4">Citing these numbers</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Each stat card has a <strong>Cite this</strong> box with buttons to copy the
            citation as text, as HTML with a link, or as a direct link to that stat.
            Please name the primary source shown on the card and credit{" "}
            {CITATION_PUBLISHER} as the compiler with a link to the page.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Need a figure we don't have? Call (970) 999-1407 or{" "}
            <Link to="/contact/" className="underline hover:text-black font-semibold">
              contact us
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
