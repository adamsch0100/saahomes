import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import {
  CITATION_HUB_URL,
  CITATION_HUB_TITLE,
  CITATION_HUB_DESCRIPTION,
  CITATION_HUB_LAST_UPDATED,
  CITATION_HUB_LAYERS,
  CITATION_HUB_STATS,
  CITATION_HUB_FAQS,
} from "../data/citationHubStats.js";

const GOLD = "#CFB36E";

const LAYER_LABELS = {
  national: "National context",
  state: "Colorado / CHFA",
  local: "Larimer & Weld counties",
  outside: "Other Colorado counties",
};

function StatCard({ stat }) {
  return (
    <article
      id={stat.id}
      className="scroll-mt-28 bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8"
    >
      <div className="flex items-center justify-between gap-4 mb-4">
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${GOLD}33`, color: "#1a1a1a" }}
        >
          {LAYER_LABELS[stat.layer] || stat.layer}
        </span>
        <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
          Verified {stat.verified}
        </span>
      </div>

      <div
        className={
          stat.figures.length > 1
            ? "grid grid-cols-2 gap-4 mb-5"
            : "mb-5"
        }
      >
        {stat.figures.map((figure) => (
          <div key={figure.label}>
            <p className="text-2xl sm:text-3xl font-bold font-serif" style={{ color: "#1a1a1a" }}>
              {figure.value}
            </p>
            <p className="text-xs text-gray-500 mt-1 leading-snug">{figure.label}</p>
          </div>
        ))}
      </div>

      <p className="text-gray-800 leading-relaxed mb-4">{stat.claim}</p>

      <dl className="text-sm text-gray-600 space-y-1 mb-5">
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-700">As of:</dt>
          <dd>{stat.asOf}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-700">Source:</dt>
          <dd>
            {stat.sourceOrg} —{" "}
            <a
              href={stat.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-black"
            >
              {stat.sourceLabel}
            </a>
          </dd>
        </div>
      </dl>

      {stat.note && (
        <p className="text-xs text-gray-500 mb-5">{stat.note}</p>
      )}

      <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Cite this
        </p>
        <p className="text-sm text-gray-700 italic">{stat.cite}</p>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {stat.moneyLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="font-semibold text-black hover:underline"
          >
            {link.label} →
          </Link>
        ))}
      </div>
    </article>
  );
}

export default function ResourceStatisticsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: CITATION_HUB_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <SEO
        exactTitle={CITATION_HUB_TITLE}
        description={CITATION_HUB_DESCRIPTION}
        keywords="Northern Colorado housing statistics, CHFA income limits 2026, CHFA purchase price limits, Fort Collins median home value, Fort Collins median rent, Colorado housing data, Larimer County housing statistics, Boulder County CHFA limits"
        canonical={CITATION_HUB_URL}
        ogTitle="Northern Colorado Housing Statistics 2026 — Sourced & Dated"
        ogDescription={CITATION_HUB_DESCRIPTION}
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        ogUrl={CITATION_HUB_URL}
        jsonLd={[faqSchema]}
      />

      {/* Hero */}
      <section className="relative bg-black text-white pt-28 sm:pt-32 pb-16 sm:pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Citation Hub
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight">
            Northern Colorado Housing Statistics 2026
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl leading-relaxed">
            Sourced, dated housing numbers for Northern Colorado — the national
            mortgage-rate context, CHFA income and purchase price limits for
            Larimer and Weld counties (plus Adams and Boulder), and U.S. Census
            figures for Fort Collins and Windsor. Every figure links to its primary
            source and shows the date it was verified.
          </p>
          <p className="mt-4 text-sm text-gray-400">
            Last updated <time dateTime={CITATION_HUB_LAST_UPDATED}>{CITATION_HUB_LAST_UPDATED}</time>
            {" "}· Each number is re-verified before the date changes.
          </p>
        </div>
      </section>

      {/* How to cite / intro */}
      <section className="py-12 px-6 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4">How to use this page</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Journalists, homebuyer-education instructors, lenders, and AI assistants
            constantly need a dated, sourced housing figure. Each statistic below is a
            self-contained claim with its figure, as-of date, source organization, and
            primary-source link, so it can be cited as-is. Each card also links to the
            SAA Homes page that explains what the number means for a buyer or seller.
          </p>
          <p className="text-gray-700 leading-relaxed">
            We publish only figures that passed a citation gate: the live primary source
            was fetched, the figure matches the source, and the date is current. Numbers
            that fail that gate are held back until they are re-verified.
          </p>
        </div>
      </section>

      {/* Table of contents */}
      <section className="py-10 px-6 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Jump to a layer
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {CITATION_HUB_LAYERS.map((layer) => (
              <a
                key={layer.id}
                href={`#layer-${layer.id}`}
                className="bg-white rounded-lg border border-gray-200 p-4 hover:border-black transition-colors"
              >
                <p className="font-semibold text-black">{layer.label}</p>
                <p className="text-sm text-gray-600 mt-1">{layer.blurb}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Stat layers */}
      {CITATION_HUB_LAYERS.map((layer) => {
        const stats = CITATION_HUB_STATS.filter((s) => s.layer === layer.id);
        if (!stats.length) return null;
        return (
          <section
            key={layer.id}
            id={`layer-${layer.id}`}
            className="py-16 sm:py-20 px-6 scroll-mt-28 even:bg-gray-50"
          >
            <div className="max-w-5xl mx-auto">
              <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-3">{layer.label}</h2>
              <p className="text-lg text-gray-700 mb-10 max-w-3xl">{layer.blurb}</p>
              <div className="space-y-6">
                {stats.map((stat) => (
                  <StatCard key={stat.id} stat={stat} />
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* Methodology */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Methodology &amp; verification</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Figures are taken from primary sources — the Colorado Housing and Finance
            Authority for CHFA program limits and the U.S. Census Bureau for community
            statistics. Each was fetched and read directly; the figure shown matches the
            source table, and the as-of or effective date is recorded exactly as
            published.
          </p>
          <p className="text-gray-300 leading-relaxed">
            This page does not publish estimated, stale, or secondhand numbers. When a
            source is unavailable or a figure cannot be confirmed, it is held back until
            it can be re-verified, and the "Last updated" date changes only when a real
            verification or addition lands.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {CITATION_HUB_FAQS.map((faq) => (
              <details key={faq.q} className="py-5 group">
                <summary className="font-semibold text-lg cursor-pointer list-none flex justify-between gap-4">
                  {faq.q}
                  <span className="text-gray-400 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="pt-3 text-gray-700 leading-relaxed">{faq.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
            Questions about what these numbers mean for you?
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Northern Colorado.
            Call (970) 999-1407 for a free consultation.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/contact/"
              className="inline-flex items-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Contact SAA Homes
            </Link>
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-flex items-center px-8 py-3.5 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              CHFA Down Payment Assistance
            </Link>
            <Link
              to="/resources/colorado-chfa-income-limits-2026/"
              className="inline-flex items-center px-8 py-3.5 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              CHFA Limits by County 2026
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
