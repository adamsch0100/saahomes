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

// All 27 Northern Colorado entity slugs (same order as areaSeo.js)
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

// Sort key: events with exact dates sort chronologically first within a month,
// then recurring series (June-August type) by their range, then by city.
function dateSortValue(event, monthIdx) {
  if (event.dates) {
    // "Aug 7–9, 2026" → extract the day
    const dayMatch = event.dates.match(/(\d{1,2})/);
    return dayMatch ? parseInt(dayMatch[1], 10) : 0;
  }
  // Recurring: use range start month as tiebreak within the month section
  return 0.5 + (event.months[0] || 0) / 100;
}

export default function EventsCalendarPage() {
  const [month, setMonth] = useState('all');
  const [city, setCity] = useState('all');
  const [showAll, setShowAll] = useState(false);

  const allEvents = useMemo(() => getAllEvents(), []);

  // Events matching the active city filter (month handled per-section)
  const cityFiltered = useMemo(() => {
    return allEvents
      .filter((e) => city === 'all' || e.citySlug === city)
      .sort((a, b) => a.cityName.localeCompare(b.cityName));
  }, [allEvents, city]);

  // Month sections: for each month, events that happen then, date-sorted
  const monthSections = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const events = cityFiltered
        .filter((e) => e.months.includes(idx))
        .sort((a, b) => dateSortValue(a, idx) - dateSortValue(b, idx));
      return { idx, name, events };
    });
  }, [cityFiltered]);

  const activeMonthIdx = month === 'all' ? null : parseInt(month, 10);
  const visibleSections = activeMonthIdx === null
    ? monthSections
    : monthSections.filter((s) => s.idx === activeMonthIdx);

  const totalShown = visibleSections.reduce((sum, s) => sum + s.events.length, 0);
  const reviewed = useMemo(() => {
    const [yr, mo] = EVENTS_DATA_LAST_REVIEWED.split('-').map(Number);
    return new Date(yr, mo - 1, 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }, []);

  const currentMonth = new Date().getMonth();
  const currentMonthName = MONTH_NAMES[currentMonth];
  const thisMonthCount = allEvents.filter((e) => e.months.includes(currentMonth)).length;

  return (
    <>
      <SEO
        exactTitle="Northern Colorado Events Calendar 2026 | Festivals & Things to Do | SAA Homes"
        description="Browse Northern Colorado events by month or city — festivals, farmers markets, rodeos, and community celebrations across Fort Collins, Loveland, Windsor, Greeley, and 27 Front Range communities."
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
            description: "Curated flagship events across 27 Northern Colorado communities.",
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
      <section className="relative min-h-[18rem] sm:h-96 bg-cover bg-center flex items-center justify-center pt-28 sm:pt-32 pb-8"
        style={{ backgroundImage: "url('/images/Northern Colorado.webp')" }}>
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: GOLD }}>
            Northern Colorado community life
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-4">Events &amp; Happenings Calendar</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Festivals, farmers markets, rodeos, and community celebrations across {CITY_OPTIONS.length} Front Range
            cities — browse by month to see what's happening and when.
          </p>
        </div>
      </section>

      <article className="max-w-6xl mx-auto px-6 py-14">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="month-filter" className="block text-sm font-semibold text-gray-700 mb-2">
                Jump to month
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
                  🗓️ {thisMonthCount} event{thisMonthCount === 1 ? '' : 's'} happening in {currentMonthName} — use the month nav below to jump around.
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

        {/* Sticky month navigation */}
        {month === 'all' && (
          <nav className="sticky top-24 z-30 -mx-2 mb-8 px-2 py-3 overflow-x-auto bg-white/95 backdrop-blur rounded-xl border border-gray-200 shadow-sm">
            <div className="flex gap-1.5 min-w-max">
              {monthSections.map((s) => (
                <a
                  key={s.idx}
                  href={`#month-${s.idx}`}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    s.events.length
                      ? 'text-gray-800 hover:bg-black hover:text-white'
                      : 'text-gray-300 hover:bg-gray-100 cursor-not-allowed'
                  }`}
                  onClick={(e) => { if (!s.events.length) e.preventDefault(); }}
                >
                  {s.name.slice(0, 3)}
                  {s.events.length > 0 && <span className="ml-1 text-xs opacity-60">({s.events.length})</span>}
                </a>
              ))}
            </div>
          </nav>
        )}

        {/* Lead-in line */}
        <p className="text-center text-gray-600 mb-8">
          {totalShown === 0
            ? 'No events match that filter yet — try another month or city.'
            : `${totalShown} event${totalShown === 1 ? '' : 's'} found.`
          }{' '}
          <span className="text-gray-400">Data reviewed {reviewed}.</span>
        </p>

        {/* Calendar sections — one per month, date-ordered */}
        {visibleSections.map((section) => (
          <section key={section.idx} id={`month-${section.idx}`} className="mb-12 scroll-mt-36">
            <div className="flex items-baseline gap-4 mb-5 border-b-2 border-gray-900 pb-3">
              <h2 className="text-3xl font-bold font-serif">{section.name}</h2>
              <span className="text-sm text-gray-500">
                {section.events.length === 0
                  ? 'No flagship events listed'
                  : `${section.events.length} event${section.events.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {section.events.length === 0 ? (
              <p className="text-gray-400 italic text-sm pl-1">
                No flagship events listed for {section.name}. Check back — we refresh this calendar regularly.
              </p>
            ) : (
              <ol className="space-y-3">
                {section.events.map((event) => (
                  <li
                    key={`${event.citySlug}-${event.name}-${section.idx}`}
                    className="flex flex-col sm:flex-row sm:items-start gap-4 p-5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm transition-all"
                  >
                    {/* Date block */}
                    <div className="shrink-0 sm:w-24 sm:text-center">
                      {event.dates ? (
                        <div className="inline-flex sm:flex flex-col items-center px-3 py-2 rounded-lg bg-gray-900 text-white">
                          <span className="text-xs uppercase tracking-wider opacity-70">Dates</span>
                          <span className="text-sm font-bold leading-tight mt-0.5">{event.dates}</span>
                        </div>
                      ) : (
                        <div className="inline-flex sm:flex flex-col items-center px-3 py-2 rounded-lg bg-gray-100 text-gray-700">
                          <span className="text-xs uppercase tracking-wider opacity-70">Typically</span>
                          <span className="text-sm font-semibold leading-tight mt-0.5">
                            {formatMonths(event.months, event.typicalMonths)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h3 className="text-lg font-bold font-serif text-gray-900">{event.name}</h3>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${seasonBadge(event.season)}`}>
                          {event.season}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">{event.description}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                        {event.citySlug !== 'regional' ? (
                          <Link to={`/northern-colorado-areas/${event.citySlug}/`} className="font-semibold hover:underline">
                            {event.cityName} area guide →
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-700">{event.cityName}</span>
                        )}
                        {event.officialUrl && (
                          <a href={event.officialUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 hover:underline">
                            Official site ↗
                          </a>
                        )}
                        <span className="text-gray-400 text-xs">
                          {event.typicalMonths && formatMonths(event.months, event.typicalMonths)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))}

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
                neighborhoods, schools, and markets in all 27 communities.
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
