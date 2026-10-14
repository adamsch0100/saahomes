/**
 * Pages another brokerage's own domain shows in place of SAA's: a clean branded
 * home, a contact page and a not-found page. Everything comes from the tenant
 * brand (useTenant); a missing value is left out, never filled with SAA's.
 * Rendered by BrokerageRouteGuard, never on saahomes.com.
 */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import AskSearchBox from "../components/AskSearchBox.jsx";
import HomeValueCapture from "../components/HomeValueCapture.jsx";
import ListingPhotoFallback from "../components/ListingPhotoFallback.jsx";
import SaveHomeButton from "../components/SaveHomeButton.jsx";
import { CourtesyLine, SampleBadge } from "../components/ListingAttribution.jsx";
import { useTenant } from "../context/TenantContext.jsx";
import { photoUrl } from "../utils/photoUrl.js";
import { formatPrice, listingStatsLine } from "../utils/listingHelpers.js";
import { getTenantAgents, submitContactForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

function useBrand() {
  const { tenant } = useTenant();
  const b = tenant?.brand || {};
  return {
    name: b.brandName || tenant?.name || "",
    tagline: b.tagline || null,
    phone: b.phone || null,
    tel: b.tel || (b.phone ? `tel:${b.phone}` : null),
    email: b.email || null,
    address: b.address || null,
    market: tenant?.marketName || b.marketName || null,
    agentName: tenant?.agentName || b.agentName || null,
  };
}

const primaryBtn =
  "inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-[color:var(--brand-accent)] hover:bg-[color:var(--brand-accent-hover)] text-[color:var(--brand-on-accent)] font-semibold transition-colors";

function ListingCard({ listing }) {
  const [failed, setFailed] = useState(false);
  const addr = [listing.street_number, listing.street_name].filter(Boolean).join(" ");
  const stats = listingStatsLine(listing);
  const hasPhoto =
    (Array.isArray(listing.photos) && listing.photos.length > 0) || Number(listing.photos_count) > 0 || !!listing.id;
  return (
    <Link
      to={`/homes-for-sale/${listing.slug}/`}
      className="group relative block bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-accent)]"
    >
      <div className="relative aspect-[4/3] bg-[#1a1a1a] overflow-hidden">
        {!hasPhoto || failed ? (
          <ListingPhotoFallback className="w-full h-full absolute inset-0" />
        ) : (
          <img
            src={photoUrl(listing.id, 0)}
            alt={addr ? `Photo of ${addr}${listing.city ? ` in ${listing.city}` : ""}` : "Home for sale"}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}
        <div
          className="absolute top-2 right-2 z-10"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <SaveHomeButton listing={listing} />
        </div>
        <SampleBadge listing={listing} className="absolute top-2 left-2 z-[1]" />
        <span className="absolute bottom-2 left-2 bg-black/75 text-white text-sm font-bold px-3 py-1 rounded-lg">
          {formatPrice(listing.list_price)}
        </span>
      </div>
      <div className="p-4">
        {stats ? <p className="text-sm text-gray-700 font-medium">{stats}</p> : null}
        <p className="mt-1.5 text-gray-900 font-semibold truncate">{addr}</p>
        <p className="text-gray-500 text-sm truncate">
          {[listing.city, listing.postal_code].filter(Boolean).join(" ")}
        </p>
        <CourtesyLine listing={listing} className="mt-1" />
      </div>
    </Link>
  );
}

function NewListings() {
  const [listings, setListings] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/listings?limit=6&sort=newest`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setListings(d?.success && Array.isArray(d.data) ? d.data.slice(0, 6) : []);
      })
      .catch(() => {
        if (!cancelled) setListings([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { tenant } = useTenant();
  // Until the MLS approves the site, these are sample homes; say so.
  const sample = tenant?.listings?.mode === "demo";
  if (listings && listings.length === 0) return null;

  return (
    <section className="py-14 sm:py-16 px-4 sm:px-6" aria-labelledby="new-listings-heading">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between gap-3 mb-6">
          <h2 id="new-listings-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif">
            {sample ? "Try the search" : "New on the market"}
          </h2>
          <Link to="/properties/" className="text-sm font-semibold text-gray-700 underline underline-offset-2 hover:text-black">
            See all homes
          </Link>
        </div>
        {sample && (
          <p className="-mt-3 mb-5 text-sm text-gray-600">
            These are sample homes so you can see how the search works. Real homes for sale appear here soon.
          </p>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings
            ? listings.map((l) => <ListingCard key={l.listing_id || l.id || l.slug} listing={l} />)
            : Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-72 rounded-xl bg-gray-100 animate-pulse" aria-hidden="true" />
              ))}
        </div>
      </div>
    </section>
  );
}

function AgentCard({ agent }) {
  const initials = String(agent.name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm flex gap-4">
      <div className="h-20 w-20 shrink-0 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
        {agent.photo_url ? (
          <img src={agent.photo_url} alt={agent.name || ""} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <span className="text-xl font-bold text-gray-400">{initials}</span>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900">{agent.name}</p>
        {agent.title ? <p className="text-sm text-gray-500">{agent.title}</p> : null}
        {agent.bio ? <p className="text-sm text-gray-600 mt-2 line-clamp-3">{agent.bio}</p> : null}
        <div className="mt-2 space-y-0.5 text-sm">
          {agent.phone ? (
            <a href={`tel:${agent.phone}`} className="block text-gray-800 hover:underline">
              {agent.phone}
            </a>
          ) : null}
          {agent.email ? (
            <a href={`mailto:${agent.email}`} className="block text-gray-800 hover:underline truncate">
              {agent.email}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OurAgents() {
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getTenantAgents()
      .then((res) => {
        if (!cancelled) setAgents(Array.isArray(res?.data) ? res.data : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!agents.length) return null;

  return (
    <section className="py-14 sm:py-16 px-4 sm:px-6 bg-gray-50" aria-labelledby="our-agents-heading">
      <div className="max-w-7xl mx-auto">
        <h2 id="our-agents-heading" className="text-2xl sm:text-3xl font-bold text-gray-900 font-serif mb-6">
          Our agents
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ContactBand({ brand }) {
  return (
    <section className="py-14 sm:py-16 px-4 sm:px-6 text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold font-serif">Ready to talk?</h2>
        <p className="mt-3 text-white/80">
          Buying, selling or just curious what's out there{brand.name ? `, ${brand.name} can help` : ""}.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/contact/" className={primaryBtn}>
            Contact us
          </Link>
          {brand.phone ? (
            <a
              href={brand.tel}
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg border-2 border-white text-white font-semibold hover:bg-white/10 transition-colors"
            >
              Call {brand.phone}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function BrokerageHomePage() {
  const brand = useBrand();
  const title = [brand.name, brand.market ? `Homes for Sale in ${brand.market}` : "Homes for Sale"]
    .filter(Boolean)
    .join(" | ");

  return (
    <>
      <SEO
        exactTitle={title}
        description={
          brand.tagline ||
          `Search every home for sale${brand.market ? ` in ${brand.market}` : ""}${brand.name ? ` with ${brand.name}` : ""}.`
        }
      />
      <section
        id="home"
        className="relative w-full text-white pt-32 sm:pt-40 lg:pt-44 pb-16 sm:pb-20 px-4 sm:px-6"
        style={{ backgroundColor: "var(--brand-primary)" }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight font-serif">{brand.name}</h1>
          <p className="mt-4 text-lg sm:text-xl text-white/85">
            {brand.tagline || (brand.market ? `Homes for sale in ${brand.market}` : "Find your next home")}
          </p>
          <div className="mt-8">
            <AskSearchBox />
          </div>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/properties/" className={primaryBtn}>
              Browse all homes
            </Link>
            <a
              href="#home-value"
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg border-2 border-white text-white font-semibold hover:bg-white/10 transition-colors"
            >
              What's my home worth?
            </a>
          </div>
        </div>
      </section>

      <NewListings />
      <OurAgents />

      <section id="home-value" className="py-14 sm:py-16 px-4 sm:px-6 scroll-mt-28">
        <div className="max-w-2xl mx-auto">
          <HomeValueCapture areaName={brand.market || ""} talkLabel="Talk to an agent — free, no pressure" />
        </div>
      </section>

      <ContactBand brand={brand} />
    </>
  );
}

const INTERESTS = ["Buying a home", "Selling a home", "Both buying and selling", "Just have a question"];

export function BrokerageContactPage() {
  const brand = useBrand();
  const initialInterest = (() => {
    if (typeof window === "undefined") return INTERESTS[0];
    const q = new URLSearchParams(window.location.search).get("interest");
    return q || INTERESTS[0];
  })();
  const [form, setForm] = useState({ name: "", email: "", phone: "", interest: initialInterest, message: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Name, email and phone are required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitContactForm(
        withLeadMetadata(
          {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            interest: form.interest,
            message: form.message.trim(),
          },
          "/contact/"
        )
      );
      setSent(true);
    } catch (err) {
      setError(err.message || "Couldn't send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1 w-full min-h-[48px] border border-gray-300 rounded-lg px-3 text-base focus:outline-none focus:ring-2 focus:ring-black";

  return (
    <>
      <SEO
        exactTitle={brand.name ? `Contact ${brand.name}` : "Contact us"}
        description={`Get in touch${brand.name ? ` with ${brand.name}` : ""} about buying or selling a home.`}
      />
      <section className="pt-32 sm:pt-40 pb-12 px-4 sm:px-6 text-white" style={{ backgroundColor: "var(--brand-primary)" }}>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold font-serif">Contact {brand.name || "us"}</h1>
          <p className="mt-3 text-white/80">Tell us what you're looking for and an agent will reach out.</p>
        </div>
      </section>
      <section className="py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid gap-10 lg:grid-cols-[1fr_20rem]">
          <div>
            {sent ? (
              <div className="rounded-xl bg-green-50 border border-green-200 p-6">
                <p className="text-lg font-semibold text-gray-900">Thanks{form.name ? `, ${form.name.split(" ")[0]}` : ""}!</p>
                <p className="text-gray-700 mt-1">We got your message and will be in touch shortly.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Name *</span>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} autoComplete="name" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Phone *</span>
                    <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} autoComplete="tel" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-gray-700">Email *</span>
                    <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} autoComplete="email" />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-gray-700">I'm interested in</span>
                    <select value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} className={`${inputClass} bg-white`}>
                      {[...new Set([form.interest, ...INTERESTS])].map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-sm font-medium text-gray-700">Message</span>
                    <textarea
                      rows={5}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-black"
                    />
                  </label>
                </div>
                {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
                <button type="submit" disabled={busy} className={`${primaryBtn} disabled:opacity-60`}>
                  {busy ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </div>
          {(brand.phone || brand.email || brand.address) && (
            <aside className="space-y-4">
              {brand.phone ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Call or text</p>
                  <a href={brand.tel} className="text-xl font-semibold text-gray-900 hover:underline">
                    {brand.phone}
                  </a>
                </div>
              ) : null}
              {brand.email ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</p>
                  <a href={`mailto:${brand.email}`} className="text-lg font-semibold text-gray-900 hover:underline break-all">
                    {brand.email}
                  </a>
                </div>
              ) : null}
              {brand.address ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Office</p>
                  <p className="text-gray-800">{brand.address}</p>
                </div>
              ) : null}
            </aside>
          )}
        </div>
      </section>
    </>
  );
}

export function BrokerageNotFoundPage() {
  const brand = useBrand();
  return (
    <>
      <SEO exactTitle={brand.name ? `Page not found | ${brand.name}` : "Page not found"} description="This page isn't here." robots="noindex, follow" />
      <section className="min-h-[70vh] flex items-center justify-center pt-32 pb-16 px-4 sm:px-6">
        <div className="max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-[color:var(--brand-accent-text)]">404</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gray-900 font-serif">This page isn't here</h1>
          <p className="mt-3 text-gray-600">It may have moved, or the link may be wrong.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/properties/" className={primaryBtn}>
              Search homes
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg border-2 border-gray-900 text-gray-900 font-semibold hover:bg-gray-50 transition-colors"
            >
              Go home
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
