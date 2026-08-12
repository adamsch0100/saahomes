import React from "react";
import { Link } from "react-router-dom";

const GOLD = "#CFB36E";

const CITY_COPY = {
  "fort-collins": {
    city: "Fort Collins",
    lines: [
      "Eligible buyers can use a VA loan on a Fort Collins primary residence — typically 0% down and no monthly PMI, subject to VA and lender approval.",
      "The Northern Colorado VA Clinic is a short drive south in Loveland. Schwartz and Associates gives 0.5% of the purchase price back to veterans who buy with us, applied as a home warranty, toward closing costs, or as a price reduction.",
    ],
  },
  loveland: {
    city: "Loveland",
    lines: [
      "Loveland is home to the Northern Colorado VA Clinic at 4575 Byrd Drive — a practical anchor for veterans who want care nearby.",
      "A VA loan can finance an eligible Loveland primary residence with no VA-required down payment and no PMI. Buy with SAA Homes and receive 0.5% of the purchase price back, disclosed in writing at closing.",
    ],
  },
  windsor: {
    city: "Windsor",
    lines: [
      "Windsor sits between Fort Collins and Greeley on the I-25 corridor — a common fit for military families who want newer housing and a short drive to the Loveland VA Clinic.",
      "VA loans can be used on eligible Windsor primary residences. Veterans who buy with Schwartz and Associates receive 0.5% of the purchase price back, applied however they choose.",
    ],
  },
  greeley: {
    city: "Greeley",
    lines: [
      "Greeley often offers a more accessible price point for VA buyers using 0% down. The Weld County Veterans Service Office is in Greeley and can help with VA claims and a Certificate of Eligibility.",
      "Schwartz and Associates gives 0.5% of the purchase price back to veterans who buy with us — home warranty, closing costs, or a price reduction — disclosed in writing at closing.",
    ],
  },
};

export default function CityVeteransSection({ citySlug }) {
  const copy = CITY_COPY[citySlug];
  if (!copy) return null;

  return (
    <section
      id="veterans"
      className="mb-12 scroll-mt-28 rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm"
      aria-labelledby={`${citySlug}-veterans-heading`}
    >
      <div className="px-6 sm:px-8 py-8 sm:py-10">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] mb-2"
          style={{ color: GOLD }}
        >
          Veterans · VA loans
        </p>
        <h2
          id={`${citySlug}-veterans-heading`}
          className="text-3xl sm:text-4xl font-bold font-serif text-gray-900 mb-4"
        >
          Veterans — VA loans &amp; 0.5% back in {copy.city}
        </h2>
        {copy.lines.map((line) => (
          <p key={line} className="text-lg text-gray-700 leading-relaxed mb-4 max-w-3xl">
            {line}
          </p>
        ))}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 mt-2">
          <Link
            to="/veterans/"
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Veterans hub — 0.5% back
          </Link>
          <a
            href="tel:9709991407"
            className="inline-flex items-center justify-center px-6 py-3 border-2 font-semibold rounded-lg transition-colors hover:bg-[#CFB36E]/10"
            style={{ borderColor: GOLD, color: "#1a1a1a" }}
          >
            (970) 999-1407
          </a>
        </div>
      </div>
    </section>
  );
}
