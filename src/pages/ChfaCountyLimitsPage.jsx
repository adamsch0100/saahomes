import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import {
  CHFA_COUNTY_LIMITS_PATH,
  CHFA_COUNTY_LIMITS_URL,
  CHFA_COUNTY_LIMITS_TITLE,
  CHFA_COUNTY_LIMITS_DESCRIPTION,
  CHFA_COUNTY_LIMITS_LAST_UPDATED,
  CHFA_COUNTY_LIMITS_EFFECTIVE,
  CHFA_COUNTY_SOURCE_ORG,
  CHFA_COUNTY_SOURCE_LABEL,
  CHFA_COUNTY_SOURCE_URL,
  CHFA_COUNTY_LIMITS,
  CHFA_COUNTY_FAQS,
} from "../data/chfaCountyLimits.js";

const GOLD = "#CFB36E";

export default function ChfaCountyLimitsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: CHFA_COUNTY_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  return (
    <>
      <SEO
        exactTitle={CHFA_COUNTY_LIMITS_TITLE}
        description={CHFA_COUNTY_LIMITS_DESCRIPTION}
        keywords="CHFA income limits 2026, CHFA purchase price limits 2026, CHFA county limits, CHFA Larimer County, CHFA Weld County, CHFA Boulder County, CHFA Adams County, CHFA maximum loan limit 2026, CHFA targeted area"
        canonical={CHFA_COUNTY_LIMITS_URL}
        ogTitle="CHFA Income &amp; Purchase Price Limits 2026 by County"
        ogDescription={CHFA_COUNTY_LIMITS_DESCRIPTION}
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        ogUrl={CHFA_COUNTY_LIMITS_URL}
        jsonLd={[faqSchema]}
      />

      {/* Hero */}
      <section className="relative bg-black text-white pt-28 sm:pt-32 pb-16 sm:pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Citation Table
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight">
            CHFA Income &amp; Purchase Price Limits 2026 by County
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl leading-relaxed">
            The verified CHFA income and purchase price limits for Larimer, Weld,
            Boulder, and Adams counties — effective for locks on or after June 15,
            2026. Every row links to the official CHFA limits table and shows the
            date it was verified.
          </p>
          <p className="mt-4 text-sm text-gray-400">
            Last updated <time dateTime={CHFA_COUNTY_LIMITS_LAST_UPDATED}>{CHFA_COUNTY_LIMITS_LAST_UPDATED}</time>
            {" "}· Each figure is re-verified before the date changes.
          </p>
        </div>
      </section>

      {/* How to use */}
      <section className="py-12 px-6 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4">How to use this table</h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            CHFA sets income and purchase price limits by county, household size, and
            whether the property is in a designated targeted area. This page collects
            the figures verified against the official CHFA Income &amp; Purchase Price
            Limits table so buyers, lenders, and instructors can read them in one place.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Only counties whose rows were read and confirmed against the source appear
            here. Limits are updated periodically — always confirm the current figures
            with CHFA or a participating lender before you rely on them.
          </p>
        </div>
      </section>

      {/* Table */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8">
            CHFA 2026 limits by county
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-6 py-4 font-semibold">County</th>
                  <th className="px-6 py-4 font-semibold">Income limit — non-targeted (1–2 / 3+)</th>
                  <th className="px-6 py-4 font-semibold">Income limit — targeted (1–2 / 3+)</th>
                  <th className="px-6 py-4 font-semibold">Purchase price limit</th>
                </tr>
              </thead>
              <tbody>
                {CHFA_COUNTY_LIMITS.map((row, index) => (
                  <tr
                    key={row.id}
                    id={`stat-${row.id}-2026`}
                    className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                  >
                    <td className="px-6 py-5 font-semibold">
                      <Link to={row.areaPath} className="text-gray-900 hover:underline">
                        {row.county}
                      </Link>
                    </td>
                    <td className="px-6 py-5 text-gray-700">{row.incomeNonTargeted}</td>
                    <td className="px-6 py-5 text-gray-700">{row.incomeTargeted}</td>
                    <td className="px-6 py-5 text-gray-700">{row.purchasePrice}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="mt-6 text-sm text-gray-600 space-y-1">
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-gray-700">Effective:</dt>
              <dd>
                Locks on or after <time dateTime={CHFA_COUNTY_LIMITS_EFFECTIVE}>{CHFA_COUNTY_LIMITS_EFFECTIVE}</time>
              </dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="font-semibold text-gray-700">Source:</dt>
              <dd>
                {CHFA_COUNTY_SOURCE_ORG} —{" "}
                <a
                  href={CHFA_COUNTY_SOURCE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-black"
                >
                  {CHFA_COUNTY_SOURCE_LABEL}
                </a>{" "}
                (verified {CHFA_COUNTY_LIMITS_LAST_UPDATED})
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Cite a county row */}
      <section className="py-16 sm:py-20 px-6 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8">Cite a county row</h2>
          <div className="space-y-6">
            {CHFA_COUNTY_LIMITS.map((row) => (
              <article
                key={row.id}
                className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8"
              >
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-xl font-bold font-serif">{row.county}</h3>
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">
                    Verified {CHFA_COUNTY_LIMITS_LAST_UPDATED}
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-4 mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Cite this
                  </p>
                  <p className="text-sm text-gray-700 italic">{row.cite}</p>
                </div>
                <Link
                  to={row.areaPath}
                  className="text-sm font-semibold text-black hover:underline"
                >
                  {row.areaLabel} →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-8">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-gray-200 border-t border-b border-gray-200">
            {CHFA_COUNTY_FAQS.map((faq) => (
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
            Not sure which CHFA program fits your county?
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Northern Colorado.
            Call (970) 999-1407 for a free consultation.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/chfa-down-payment-assistance/"
              className="inline-flex items-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              CHFA Down Payment Assistance
            </Link>
            <Link
              to="/chfa-schools-to-home/"
              className="inline-flex items-center px-8 py-3.5 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              CHFA Schools To Home
            </Link>
            <Link
              to="/resources/northern-colorado-housing-statistics-2026/"
              className="inline-flex items-center px-8 py-3.5 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              Northern Colorado Housing Statistics
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
