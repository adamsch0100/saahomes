import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import CiteBlock from "../components/CiteBlock";
import {
  MORTGAGE_RATES_URL,
  MORTGAGE_RATES_TITLE,
  MORTGAGE_RATES_DESCRIPTION,
  MORTGAGE_RATES_LAST_UPDATED,
  MORTGAGE_RATES_SOURCE_ORG,
  MORTGAGE_RATES_SOURCE_LABEL,
  MORTGAGE_RATES_SOURCE_URL,
  MORTGAGE_RATES_FRED_SOURCES,
  MORTGAGE_RATES_YEAR_AGO,
  MORTGAGE_RATES_WEEKLY,
  MORTGAGE_RATES_CURRENT,
  MORTGAGE_RATES_CITE,
  MORTGAGE_RATES_FAQS,
} from "../data/mortgageRatesStats.js";

const GOLD = "var(--brand-accent)";

function formatRate(value) {
  return `${value.toFixed(2)}%`;
}

function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

function delta(current, previous) {
  const diff = current - previous;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "±";
  return `${sign}${Math.abs(diff).toFixed(2)}`;
}

function CurrentCard({ label, value, prior, yearAgo }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className="text-4xl sm:text-5xl font-bold font-serif mt-3"
        style={{ color: "#1a1a1a" }}
      >
        {formatRate(value)}
      </p>
      <dl className="mt-5 text-sm text-gray-600 space-y-1">
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-700">Vs. prior week:</dt>
          <dd>{delta(value, prior)} pts</dd>
        </div>
        <div className="flex gap-2">
          <dt className="font-semibold text-gray-700">Vs. a year earlier:</dt>
          <dd>
            {delta(value, yearAgo)} pts (was {formatRate(yearAgo)} on{" "}
            {formatDate(MORTGAGE_RATES_YEAR_AGO.date)})
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default function MortgageRatesStatisticsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: MORTGAGE_RATES_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };

  const weekly = [...MORTGAGE_RATES_WEEKLY].reverse();

  return (
    <>
      <SEO
        exactTitle={MORTGAGE_RATES_TITLE}
        description={MORTGAGE_RATES_DESCRIPTION}
        keywords="mortgage rates statistics, 30-year fixed mortgage rate, 15-year fixed mortgage rate, mortgage rate history 2026, Freddie Mac PMMS, weekly mortgage rates"
        canonical={MORTGAGE_RATES_URL}
        ogTitle="Mortgage Rates 2026 — Weekly 30 & 15-Year Averages"
        ogDescription={MORTGAGE_RATES_DESCRIPTION}
        ogImage="https://saahomes.com/images/Northern Colorado.webp"
        ogUrl={MORTGAGE_RATES_URL}
        jsonLd={[faqSchema]}
      />

      {/* Hero */}
      <section className="relative bg-black text-white pt-28 sm:pt-32 pb-16 sm:pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Mortgage Rate Statistics
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-serif leading-tight">
            Mortgage Rates 2026: Weekly 30 &amp; 15-Year Averages
          </h1>
          <p className="mt-4 text-lg text-gray-300 max-w-3xl leading-relaxed">
            The current national average for the 30-year and 15-year fixed
            mortgage, and every weekly reading since January 2026. Each figure
            comes from Freddie Mac&rsquo;s Primary Mortgage Market Survey and
            links to its source.
          </p>
          <p className="mt-4 text-sm text-gray-400">
            Last updated{" "}
            <time dateTime={MORTGAGE_RATES_LAST_UPDATED}>
              {MORTGAGE_RATES_LAST_UPDATED}
            </time>{" "}
            · Refreshed every week after the Thursday PMMS release.
          </p>
        </div>
      </section>

      {/* Current rates */}
      <section className="py-12 px-6 bg-gray-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6">
            This week&rsquo;s national average
          </h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <CurrentCard
              label={`30-year fixed — week of ${formatDate(MORTGAGE_RATES_CURRENT.date)}`}
              value={MORTGAGE_RATES_CURRENT.thirty}
              prior={MORTGAGE_RATES_CURRENT.thirtyPrior}
              yearAgo={MORTGAGE_RATES_YEAR_AGO.thirty}
            />
            <CurrentCard
              label={`15-year fixed — week of ${formatDate(MORTGAGE_RATES_CURRENT.date)}`}
              value={MORTGAGE_RATES_CURRENT.fifteen}
              prior={MORTGAGE_RATES_CURRENT.fifteenPrior}
              yearAgo={MORTGAGE_RATES_YEAR_AGO.fifteen}
            />
          </div>
        </div>
      </section>

      {/* Weekly history table */}
      <section className="py-16 sm:py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-3">
            Weekly mortgage rate history, 2026
          </h2>
          <p className="text-lg text-gray-700 mb-8 max-w-3xl">
            Every Freddie Mac PMMS national average published since the start
            of 2026, newest first. The week is the Thursday the survey was
            released; the rate is the average of loan rates offered the prior
            Thursday through Wednesday.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-left">
              <caption className="sr-only">
                Freddie Mac Primary Mortgage Market Survey weekly national
                averages for the 30-year and 15-year fixed mortgage, 2026.
              </caption>
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-5 py-3 text-sm font-bold text-gray-700">
                    Week of
                  </th>
                  <th scope="col" className="px-5 py-3 text-sm font-bold text-gray-700">
                    30-year fixed
                  </th>
                  <th scope="col" className="px-5 py-3 text-sm font-bold text-gray-700">
                    15-year fixed
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {weekly.map((row) => (
                  <tr key={row.date} id={`week-${row.date}`} className="scroll-mt-28">
                    <th scope="row" className="px-5 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">
                      {formatDate(row.date)}
                    </th>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {formatRate(row.thirty)}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">
                      {formatRate(row.fifteen)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Cite / source */}
      <section className="py-12 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4">
            How to cite these numbers
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            Each figure is a self-contained claim with its week and source, so
            it can be cited as-is. The latest week reads:
          </p>
          <CiteBlock
            cite={MORTGAGE_RATES_CITE}
            url={MORTGAGE_RATES_URL}
            pageTitle="Mortgage Rates 2026: 30 & 15-Year Fixed Averages"
            className="mb-5"
          />
          <p className="text-gray-700 leading-relaxed mb-2">
            Primary source:{" "}
            <a
              href={MORTGAGE_RATES_SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-black font-semibold"
            >
              {MORTGAGE_RATES_SOURCE_ORG} — {MORTGAGE_RATES_SOURCE_LABEL}
            </a>{" "}
            ({MORTGAGE_RATES_SOURCE_ORG}, released weekly).
          </p>
          <p className="text-gray-700 leading-relaxed">
            Machine-readable series:{" "}
            {MORTGAGE_RATES_FRED_SOURCES.map((s, i) => (
              <React.Fragment key={s.url}>
                {i > 0 ? " · " : ""}
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-black"
                >
                  {s.label}
                </a>
              </React.Fragment>
            ))}{" "}
            via the Federal Reserve Bank of St. Louis (FRED).
          </p>
        </div>
      </section>

      {/* What this means for buyers */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
            What a mortgage rate means for your payment
          </h2>
          <p className="text-gray-700 leading-relaxed mb-4">
            The rate is only one input in a monthly payment. Loan amount,
            down payment, term, taxes, and insurance all change the number.
            A higher rate raises the cost of borrowing and the monthly payment
            for the same loan amount; a lower rate does the opposite.
          </p>
          <p className="text-gray-700 leading-relaxed mb-6">
            Run your own scenario against today&rsquo;s average with the
            calculator below, then get a real quote from a lender. Freddie Mac
            reports that shopping around and comparing multiple quotes can save
            thousands over the life of a loan.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <Link to="/mortgage-calculator/" className="font-semibold text-black hover:underline">
              Mortgage Calculator →
            </Link>
            <Link to="/for-buyers/" className="font-semibold text-black hover:underline">
              Northern Colorado Buyer Guide →
            </Link>
            <Link to="/chfa-down-payment-assistance/" className="font-semibold text-black hover:underline">
              CHFA Down Payment Assistance →
            </Link>
            <Link to="/resources/northern-colorado-housing-statistics-2026/" className="font-semibold text-black hover:underline">
              Northern Colorado Housing Statistics →
            </Link>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="py-16 px-6 bg-black text-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">
            Methodology &amp; verification
          </h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Figures are the national averages published by Freddie Mac&rsquo;s
            Primary Mortgage Market Survey. They are retrieved from the Federal
            Reserve Bank of St. Louis (FRED) series MORTGAGE30US and
            MORTGAGE15US, which republish the same PMMS values, and each row is
            read directly from that source. No estimated or secondhand number is
            shown.
          </p>
          <p className="text-gray-300 leading-relaxed">
            This page does not publish a figure it cannot confirm. The
            &ldquo;Last updated&rdquo; date changes only when a real weekly
            release is added.
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
            {MORTGAGE_RATES_FAQS.map((faq) => (
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
            Questions about what these rates mean for you?
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            Adam and Mandi Schwartz help buyers and sellers across Northern
            Colorado. Call (970) 999-1407 for a free consultation.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/contact/"
              className="inline-flex items-center px-8 py-3.5 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Contact SAA Homes
            </Link>
            <Link
              to="/mortgage-calculator/"
              className="inline-flex items-center px-8 py-3.5 border-2 border-black text-black font-semibold rounded-lg hover:bg-white transition-colors"
            >
              Mortgage Calculator
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
