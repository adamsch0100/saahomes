import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO.jsx";
import {
  getAllEvents,
  getMonthNames,
  getCityDisplayName,
  getEventsGuidePath,
  EVENTS_DATA_LAST_REVIEWED,
} from "../data/localEvents.js";
import { areaSeoPages } from "../data/areaSeo.js";

const GOLD = "#CFB36E";
const MONTH_NAMES = getMonthNames();

// All 19 Northern Colorado city slugs (same order as areaSeo.js)
const CITY_OPTIONS = areaSeoPages.map((a) => ({ slug: a.slug, name: a.city }));

function formatMonths(months, typicalMonths) {
  if (typicalMonths && typicalMonths.toLowerCase().includes('varies')) return 'Dates vary — check official source';
  if (months.length === 12) return 'Year-round';
  if (months.length === 0) return typicalMonths || 'Dates vary';
  if (months.length === 1) return MONTH_NAMES[months[0]];
  // Group contiguous ranges
  const ranges = [];
  let start = months[0];
  let prev = months[0];
  for (let i = 1; i <= months.length; i++) {
    const cur = months[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    ranges.push(start === prev ? MONTH_NAMES[start] : `${MONTH_NAMES[start]}–${MONTH_NAMES[prev]}`);
    start = cur;
    prev = cur;
  }
  return ranges.join(', ');
}

function seasonBadge(season) {
  const map = {
    Winter: 'bg-blue-100 text-blue-800',
    Spring: 'bg-emerald-100 text-emerald-800',
    Summer: 'bg-amber-100 text-amber-800',
    Fall: 'bg-orange-100 text-orange-800',
  };
  return map[season] || 'bg-gray-100 text-gray-700';
}

export default function EventsCalendarPage() {
  const [month, setMonth] = useState('all');
  const [city, setCity] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const allEvents = useMemo(() => getAllEvents(), []);

  const filtered = useMemo(() => {
    const monthIdx = month === 'all' ? null : parseInt(month, 10);
    return allEvents
      .filter((e) => {
        if (city !== 'all' && e.citySlug !== city) return false;
        if (monthIdx !== null && !e.months.includes(monthIdx)) return false;
        return true;
      })
      .sort((a, b) => {
        // Events with an explicit upcoming month sort first, then by city
        const am = a.months.length ? a.months[0] : 99;
        const bm = b.months.length ? b.months[0] : 99;
        if (am !== bm) return am - bm;
        return a.cityName.localeCompare(b.cityName);
      });
  }, [allEvents, month, city]);

  const visible = showAll ? filtered : filtered.slice(0, 12);
  const reviewed = new Date(EVENTS_DATA_LAST_REVIEWED).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long',
  });

  // Show a "this month" default hint when no filter is applied
  const currentMonth = new Date().getMonth();
  const currentMonthName = MONTH_NAMES[currentMonth];
  const thisMonthCount = allEvents.filter((e) => e.months.includes(currentMonth)).length;

  return (
    <>
      <SEO
        exactTitle="Northern Colorado Events Calendar 2026 | Festivals & Things to Do | SAA Homes"
        description="Browse Northern Colorado events by month or city — festivals, farmers markets, rodeos, and community celebrations across Fort Collins, Loveland, Windsor, Greeley, and 19+ Front Range communities."
        canonical="https://saahomes.com/events/"
        ogTitle="Northern Colorado Events Calendar | SAA Homes"
        ogDescription="Find festivals, farmers markets, and community events across Northern Colorado — filter by month or city."
        ogImage="/images/Northern Colorado.webp"
        ogImageAlt="Northern Colorado events calendar"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Northern Colorado Events Calendar",
            description: "Curated flagship events across 19 Northern Colorado communities.",
            numberOfItems: allEvents.length,
          },
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Northern Colorado Events Calendar",
            url: "https://saahomes.com/events/",
          },
        ]}
      />

      {/* Hero */}
      <section className="relative bg-black text-white">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('/images/Northern Colorado.webp')" }}></div>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Northern Colorado community life
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Events &amp; Happenings Calendar</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Festivals, farmers markets, rodeos, and community celebrations across {CITY_OPTIONS.length} Front Range
            cities — filter by month or city to see what's happening near you.
          </p>
        </div>
      </section>

      <article className="max-w-6xl mx-auto px-6 py-14">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="month-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by month
              </label>
              <select
                id="month-filter"
                value={month}
                onChange={(e) => { setMonth(e.target.value); setShowAll(false); }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All months</option>
                {MONTH_NAMES.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              {month === 'all' && (
                <p className="text-sm text-gray-500 mt-2">
                  🗓️ {thisMonthCount} event{thisMonthCount === 1 ? '' : 's'} happening in {currentMonthName} — pick a month to narrow it down.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="city-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by city
              </label>
              <select
                id="city-filter"
                value={city}
                onChange={(e) => { setCity(e.target.value); setShowAll(false); }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-black"
              >
                <option value="all">All cities</option>
                {CITY_OPTIONS.map((c) => (
                  <option key={c.slug} value={c.slug}>{c.name}</option>
                ))}
              </select>
              {city !== 'all' && (
                <p className="text-sm text-gray-500 mt-2">
                  <Link to={`/northern-colorado-areas/${city}/`} className="underline hover:text-gray-900">
                    See {getCityDisplayName(city)} homes for sale →
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Lead-in line */}
        <p className="text-center text-gray-600 mb-8">
          {filtered.length === 0
            ? 'No flagship events match that filter yet — try another month or city.'
            : `${filtered.length} flagship event${filtered.length === 1 ? '' : 's'} found.`
          }{' '}
          <span className="text-gray-400">Data reviewed {reviewed}.</span>
        </p>

        {/* Event grid */}
        {visible.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((event) => (
              <div key={`${event.citySlug}-${event.name}`} className="flex flex-col rounded-xl border border-gray-200 bg-white p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${seasonBadge(event.season)}`}>
                    {event.season}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatMonths(event.months, event.typicalMonths)}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-serif text-gray-900 mb-2">{event.name}</h3>
                <p className="text-gray-600 text-sm leading-relaxed mb-4 flex-1">{event.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {event.citySlug !== 'regional' ? (
                    <Link
                      to={`/northern-colorado-areas/${event.citySlug}/`}
                      className="font-semibold hover:underline"
                    >
                      {event.cityName} area guide →
                    </Link>
                  ) : (
                    <span className="font-semibold text-gray-700">{event.cityName}</span>
                  )}
                  {event.officialUrl && (
                    <a
                      href={event.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-800 hover:underline"
                    >
                      Official site ↗
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 rounded-xl">
            <p className="text-gray-600 mb-4">No flagship events match that filter.</p>
            <button
              onClick={() => { setMonth('all'); setCity('all'); setShowAll(false); }}
              className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
            >
              Show all events
            </button>
          </div>
        )}

        {!showAll && filtered.length > 12 && (
          <div className="text-center mt-10">
            <button
              onClick={() => setShowAll(true)}
              className="inline-flex px-8 py-3 border-2 border-black text-black font-semibold rounded-lg hover:bg-black hover:text-white transition-colors"
            >
              Show all {filtered.length} events
            </button>
          </div>
        )}

        {/* Real estate CTA — the point of the page */}
        <section className="mt-16 rounded-xl overflow-hidden border border-gray-200">
          <div className="grid md:grid-cols-2">
            <div className="p-10 bg-gray-900 text-white">
              <h2 className="text-2xl sm:text-3xl font-bold font-serif mb-3">
                Love the area? Find a home near the action.
              </h2>
              <p className="text-gray-300 mb-6">
                Events like these are what make Northern Colorado home. Whether you're relocating or looking to
                settle closer to the festivals, farmers markets, and community life you love — we know the
                neighborhoods, schools, and markets in all 19 communities.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  to="/properties/"
                  className="inline-flex px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Search Homes
                </Link>
                <Link
                  to="/for-buyers/"
                  className="inline-flex px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-gray-900 transition-colors"
                >
                  Buyers Guide
                </Link>
              </div>
            </div>
            <div className="p-10" style={{ backgroundColor: GOLD }}>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-gray-900 mb-3">
                Thinking of selling?
              </h2>
              <p className="text-gray-800 mb-6">
                Community events are a big part of why buyers choose Northern Colorado. Get a free, no-pressure
                home valuation to see what your home is worth in today's market.
              </p>
              <Link
                to="/for-sellers/"
                className="inline-flex px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
              >
                Get My Home Value
              </Link>
            </div>
          </div>
        </section>

        {/* Full events guide */}
        <section className="mt-14 text-center">
          <h2 className="text-2xl font-bold font-serif mb-3">Planning further ahead?</h2>
          <p className="text-gray-600 mb-5 max-w-2xl mx-auto">
            Our full Northern Colorado events guide rounds up the year's biggest festivals, markets, and
            community traditions — perfect for relocators getting to know the area.
          </p>
          <Link
            to={getEventsGuidePath()}
            className="inline-flex px-8 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Read the 2026 Events Guide →
          </Link>
        </section>
      </article>
    </>
  );
}
