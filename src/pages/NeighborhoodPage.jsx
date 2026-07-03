import React from "react";
import { useParams, Link } from "react-router-dom";
import { getNeighborhood, getNeighborhoodUrl, buildNeighborhoodSchemas, getNeighborhoodMetaDescription } from "../data/neighborhoods.js";
import { getAreaSeo } from "../data/areaSeo.js";
import MarketReportForm from "../components/MarketReportForm.jsx";
import SEO from "../components/SEO.jsx";

function NeighborhoodHero({ neighborhood }) {
  return (
    <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8"
      style={{ backgroundImage: `url('${neighborhood.image || "/images/Northern Colorado.webp"}')` }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 text-center text-white px-6">
        <Link
          to={`/northern-colorado-areas/${neighborhood.citySlug}/`}
          className="text-sm text-gray-200 hover:text-white mb-4 inline-block"
        >
          ← Back to {neighborhood.cityDisplay} Area Guide
        </Link>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold font-serif">{neighborhood.name}</h1>
        <p className="mt-4 text-xl text-gray-200">
          {neighborhood.cityDisplay}, Colorado {neighborhood.type === "subdivision" ? "Subdivision" : "Neighborhood"} Guide
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href={`/properties/?location=${neighborhood.cityDisplay}, CO`}
            className="inline-flex items-center justify-center px-8 py-3 bg-white text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Search {neighborhood.cityDisplay} Homes
          </a>
          <a
            href="/contact/"
            className="inline-flex items-center justify-center px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors"
          >
            Talk to an Agent
          </a>
        </div>
      </div>
    </section>
  );
}

function InfoCard({ label, value }) {
  if (!value) return null;
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-1">{label}</p>
      <p className="text-gray-900 font-medium">{value}</p>
    </div>
  );
}

function NeighborhoodHighlights({ highlights }) {
  if (!highlights?.length) return null;
  return (
    <section className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6">Why choose {highlights[0]?.title?.includes(" ") ? "this neighborhood" : highlights[0]?.title}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {highlights.map((h, i) => (
          <div key={i} className="bg-amber-50 rounded-xl p-6 border border-amber-100">
            <h3 className="font-bold font-serif text-lg mb-2">{h.title}</h3>
            <p className="text-gray-700 leading-relaxed">{h.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureList({ features }) {
  if (!features?.length) return null;
  return (
    <section className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6">Neighborhood features</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-[#CFB36E] mt-0.5">✦</span>
            <span className="text-gray-700">{f}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SchoolTable({ schools }) {
  if (!schools?.length) return null;
  return (
    <section className="mb-12">
      <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-6">Schools serving {neighborhood?.name}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="py-3 px-4 font-semibold text-gray-900">School</th>
              <th className="py-3 px-4 font-semibold text-gray-900">Type</th>
              <th className="py-3 px-4 font-semibold text-gray-900">Grades</th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 px-4 font-medium">{s.name}</td>
                <td className="py-3 px-4 text-gray-600 capitalize">{s.type}</td>
                <td className="py-3 px-4 text-gray-600">{s.level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-gray-500 mt-2">School District: {neighborhood.schoolDistrict}</p>
    </section>
  );
}

export default function NeighborhoodPage() {
  const { city, neighborhood: neighborhoodSlug } = useParams();

  // Find neighborhood by slug, verify city match
  const neighborhood = getNeighborhood(neighborhoodSlug, city);
  const cityArea = getAreaSeo(city);

  if (!neighborhood || !cityArea) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center p-8">
          <h1 className="text-3xl font-bold mb-4">Neighborhood guide coming soon</h1>
          <p className="text-gray-600 mb-6">We're building out our detailed neighborhood guides for {city ? cityArea?.city || city : "this area"}.</p>
          <Link to="/northern-colorado-areas/" className="text-[#CFB36E] font-semibold hover:underline">
            ← Back to all area guides
          </Link>
        </div>
      </div>
    );
  }

  const pageUrl = getNeighborhoodUrl(neighborhood);

  return (
    <>
      <SEO
        exactTitle={`${neighborhood.name}, ${neighborhood.cityDisplay} — Neighborhood Guide | SAA Homes`}
        description={getNeighborhoodMetaDescription(neighborhood)}
        keywords={neighborhood.keywords || `${neighborhood.name} ${neighborhood.cityDisplay}, ${neighborhood.cityDisplay} real estate, ${neighborhood.cityDisplay} neighborhoods`}
        canonical={pageUrl}
        ogTitle={`${neighborhood.name} ${neighborhood.cityDisplay} Neighborhood Guide | Schwartz and Associates`}
        ogDescription={neighborhood.description}
        ogImage={`https://saahomes.com${neighborhood.image || "/images/Northern Colorado.webp"}`}
        ogUrl={pageUrl}
        jsonLd={buildNeighborhoodSchemas(neighborhood)}
      />

      <NeighborhoodHero neighborhood={neighborhood} />

      <article className="max-w-4xl mx-auto px-6 py-16">

        {/* Description */}
        <section className="mb-12">
          <h2 className="text-4xl font-bold font-serif mb-6">About {neighborhood.name}</h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-lg leading-relaxed mb-4">{neighborhood.description}</p>
            {neighborhood.longDescription && (
              <p className="text-lg leading-relaxed mb-4">{neighborhood.longDescription}</p>
            )}
          </div>
        </section>

        {/* Key info cards */}
        <section className="mb-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoCard label="Home styles" value={neighborhood.homeStyles?.join(", ")} />
          <InfoCard label="Price range" value={neighborhood.priceRangeDescription} />
          <InfoCard label="Year built" value={neighborhood.yearBuiltRange ? `${neighborhood.yearBuiltRange.min}–${neighborhood.yearBuiltRange.max}` : null} />
          <InfoCard label="School district" value={neighborhood.schoolDistrict} />
          <InfoCard label="HOA" value={neighborhood.hoaDescription} />
          <InfoCard label="Boundaries" value={neighborhood.boundaries} />
        </section>

        {/* Highlights */}
        <NeighborhoodHighlights highlights={neighborhood.neighborhoodHighlights} />

        {/* Features */}
        <FeatureList features={neighborhood.features} />

        {/* Schools */}
        <SchoolTable schools={neighborhood.schools} neighborhood={neighborhood} />

        {/* Home Search CTA */}
        <section className="mb-12 bg-gray-50 p-8 rounded-lg">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold font-serif mb-4">Search homes in {neighborhood.name}</h2>
            <p className="text-lg mb-6 text-gray-700">
              Explore available properties in {neighborhood.name}, {neighborhood.cityDisplay}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`/properties/?location=${neighborhood.name}, ${neighborhood.cityDisplay}, CO`}
                className="inline-flex items-center justify-center px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Search {neighborhood.name} Homes
              </a>
              <Link
                to="/contact/"
                className="inline-flex items-center justify-center px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
              >
                Talk to an agent
              </Link>
            </div>
          </div>
        </section>

        {/* Market report form */}
        <section className="mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-4 text-center">Get a free {neighborhood.cityDisplay} market report</h2>
          <p className="text-center text-gray-600 mb-8">
            See what homes are selling for in {neighborhood.name} and nearby areas.
          </p>
          <MarketReportForm areaName={`${neighborhood.name}, ${neighborhood.cityDisplay}`} />
        </section>

      </article>
    </>
  );
}
