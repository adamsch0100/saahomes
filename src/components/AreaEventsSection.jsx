import React from "react";
import { Link } from "react-router-dom";
import { getCityEvents, getEventsGuidePath, EVENTS_DATA_LAST_REVIEWED } from "../data/localEvents";

const GOLD = "#CFB36E";

export default function AreaEventsSection({ city, slug }) {
  const events = getCityEvents(slug);
  if (!events.length) return null;

  const reviewedLabel = new Date(EVENTS_DATA_LAST_REVIEWED).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
  });

  return (
    <section className="py-16 px-6 bg-white border-t border-gray-100">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm font-semibold uppercase tracking-widest text-center mb-2" style={{ color: GOLD }}>
          Community life
        </p>
        <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4 text-center">
          Events &amp; Happenings in {city}
        </h2>
        <p className="text-lg text-gray-600 text-center mb-10 max-w-2xl mx-auto">
          Relocating to {city}? These flagship annual events give you a feel for the community — farmers markets,
          festivals, and celebrations that make Northern Colorado home.
        </p>

        <ul className="space-y-6">
          {events.map((event) => (
            <li
              key={event.name}
              className="p-6 rounded-xl border border-gray-100 bg-gray-50 hover:border-gray-200 transition-colors"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <h3 className="text-xl font-bold font-serif text-gray-900">{event.name}</h3>
                <span className="text-sm font-semibold text-gray-500">
                  {event.season}
                  {event.typicalMonths ? ` · ${event.typicalMonths}` : ""}
                </span>
              </div>
              <p className="text-gray-700 leading-relaxed mb-3">{event.description}</p>
              {event.officialUrl && (
                <a
                  href={event.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-gray-900 hover:underline"
                >
                  Official info →
                </a>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-10 text-center">
          <Link
            to={getEventsGuidePath()}
            className="inline-flex items-center justify-center px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors"
          >
            Full Northern Colorado events guide
          </Link>
          <p className="text-xs text-gray-500 mt-3">Curated guide · Last reviewed {reviewedLabel}</p>
        </div>
      </div>
    </section>
  );
}
