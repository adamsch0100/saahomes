import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import HomeValueChart from "../components/HomeValueChart";
import RecentClosedSales from "../components/RecentClosedSales";
import CompsWorkbench from "../components/CompsWorkbench";
import SellerDashboard from "../components/seller/SellerDashboard";
import { marketPack } from "../data/marketPack";
import { useBrokerageBrand } from "../context/TenantContext.jsx";
import { formatPrice } from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const GOLD = "var(--brand-accent)";
const AGENT_PHONE = marketPack.market.phone;
const AGENT_TEL = marketPack.market.tel;

const fmt = formatPrice;

function addressLine(h) {
  if (!h) return "";
  return [h.address_line, h.unit ? `Unit ${h.unit}` : null, h.city, h.state || "CO", h.postal_code]
    .filter(Boolean)
    .join(", ");
}

const SELLER_ACTIONS = [
  {
    key: "analysis",
    question: "How accurate is this?",
    cta: "Get My Full Market Analysis",
    href: "/for-sellers/#market-report",
    heat: true,
    primary: true,
  },
  {
    key: "sellfor",
    question: "What would I actually get?",
    cta: "What Would My Home Sell For?",
    href: "/for-sellers/",
  },
  {
    key: "timing",
    question: "Am I leaving money on the table?",
    cta: "Is Now the Right Time to Sell?",
    href: "/for-sellers/",
  },
  {
    key: "updates",
    question: "I'm not selling yet, but…",
    cta: "Keep Me Updated on My Home's Value",
    action: "enable_updates",
  },
  {
    key: "talk",
    question: "What are my options?",
    cta: `Talk to Adam & Mandi — Free, No Pressure`,
    href: AGENT_TEL,
    sub: AGENT_PHONE,
  },
  {
    key: "refi",
    question: "Refinance curiosity",
    cta: "Refinance? We'll Connect You With a Great Local Lender",
    href: "/contact/",
    sub: "We refer — never advise rates",
  },
  {
    key: "ask",
    question: "Question about the home",
    cta: "Ask Nadia — Questions About This Home?",
    href: "/contact/",
  },
];

export default function MyHomePage() {
  const [searchParams] = useSearchParams();
  // Another brokerage's domain: talk to its agents, call its phone.
  const bb = useBrokerageBrand();
  const sellerActions = bb
    ? SELLER_ACTIONS.map((a) =>
        a.key === "talk"
          ? { ...a, cta: "Talk to an Agent — Free, No Pressure", href: bb.tel || "/contact/?interest=Selling a home", sub: bb.phone || null }
          : a
      )
    : SELLER_ACTIONS;
  const token = searchParams.get("token") || "";
  const unsub = searchParams.get("unsubscribe") === "1";
  const stopKind = searchParams.get("stop") || "";
  const [mode, setMode] = useState(searchParams.get("mode") === "seller" ? "seller" : "value");
  const [sellerPlan, setSellerPlan] = useState(undefined); // undefined loading | null none | plan
  const [stay, setStay] = useState(null);
  const [startingPlan, setStartingPlan] = useState(false);

  const [session, setSession] = useState(null); // null loading | false guest | data
  const [homes, setHomes] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [value, setValue] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loadingValue, setLoadingValue] = useState(false);
  const [error, setError] = useState("");
  const [accuracy, setAccuracy] = useState(null); // close | off
  const [nextCta, setNextCta] = useState(null);
  const [form, setForm] = useState({
    address_line: "",
    city: "",
    postal_code: "",
    living_area: "",
    beds: "",
    baths: "",
  });
  const [saving, setSaving] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMode, setLoginMode] = useState("link");
  const [loginMsg, setLoginMsg] = useState("");
  const [toast, setToast] = useState("");

  const authQ = token ? `?token=${encodeURIComponent(token)}` : "";

  const loadHomes = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/home${authQ}`, { credentials: "same-origin" });
      const d = await res.json().catch(() => ({}));
      if (res.status === 401) {
        setSession(false);
        setHomes([]);
        return;
      }
      if (!res.ok || !d.success) throw new Error(d.error || "Could not load your home.");
      setSession(d.data);
      setHomes(d.data.homes || []);
      if (d.data.homes?.length && !activeId) {
        setActiveId(d.data.homes[0].id);
      }
    } catch (err) {
      setError(err.message || "Could not load.");
      setSession(false);
    }
  }, [authQ, activeId]);

  useEffect(() => {
    loadHomes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Unsubscribe from value updates via email link
  useEffect(() => {
    if (!unsub || !activeId || session === null || session === false) return;
    (async () => {
      try {
        await fetch(`${API_BASE}/api/home/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ value_updates_enabled: false, token: token || undefined }),
        });
        setToast("You're unsubscribed from monthly home-value emails.");
      } catch {
        /* non-blocking */
      }
    })();
  }, [unsub, activeId, session, token]);

  // Selling plan and the "stay in touch" emails, once signed in.
  useEffect(() => {
    if (!session || session === false) return;
    fetch(`${API_BASE}/api/seller${authQ}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setSellerPlan(d?.success ? d.data : null))
      .catch(() => setSellerPlan(null));
    fetch(`${API_BASE}/api/stay/me${authQ}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => setStay(d?.success ? d.data : null))
      .catch(() => setStay(null));
  }, [session, authQ]);

  // One-click unsubscribe from one kind of email (?stop=anniversary etc.)
  useEffect(() => {
    if (!stopKind || !session || session === false) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stay/me${authQ}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ kind: stopKind, on: false }),
        });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.success) {
          setStay(d.data);
          const label = d.data.kinds?.find((k) => k.kind === stopKind)?.label;
          setToast(`Done. You won't get ${label ? `the ${label.toLowerCase()}` : "those emails"} anymore. You can turn it back on below.`);
        }
      } catch {
        /* non-blocking */
      }
    })();
  }, [stopKind, session, authQ]);

  const setStayKind = async (kind, on) => {
    try {
      const res = await fetch(`${API_BASE}/api/stay/me${authQ}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(kind ? { kind, on } : { target_rate: on }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not save.");
      setStay(d.data);
    } catch (err) {
      setError(err.message);
    }
  };

  const startSelling = async () => {
    setStartingPlan(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/seller/start${authQ}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ home_profile_id: activeId || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not start your plan.");
      setSellerPlan(d.data);
      setMode("seller");
      setToast("Your selling plan is ready. Your agent has been told.");
    } catch (err) {
      setError(err.message);
    } finally {
      setStartingPlan(false);
    }
  };

  const loadValue = useCallback(
    async (id) => {
      if (!id) return;
      setLoadingValue(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/home/${id}/value${authQ}`, {
          credentials: "same-origin",
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok || !d.success) throw new Error(d.error || "Could not load value.");
        setProfile(d.data.profile);
        setValue(d.data.value);
        setAccuracy(d.data.profile?.accuracy_signal || null);
      } catch (err) {
        setError(err.message || "Could not load value.");
      } finally {
        setLoadingValue(false);
      }
    },
    [authQ]
  );

  useEffect(() => {
    if (activeId && session && session !== false) {
      loadValue(activeId);
    }
  }, [activeId, session, loadValue]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!form.address_line.trim()) {
      setError("Street address is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/home/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...form,
          living_area: form.living_area ? Number(form.living_area) : undefined,
          beds: form.beds ? Number(form.beds) : undefined,
          baths: form.baths ? Number(form.baths) : undefined,
          token: token || undefined,
          fetchAvm: true,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not save.");
      setProfile(d.data.profile);
      setValue(d.data.value);
      setActiveId(d.data.profile.id);
      setToast("Home saved — estimate ready.");
      await loadHomes();
    } catch (err) {
      setError(err.message || "Could not save home.");
    } finally {
      setSaving(false);
    }
  };

  const sendAccuracy = async (signal) => {
    if (!activeId) return;
    try {
      const res = await fetch(`${API_BASE}/api/home/${activeId}/accuracy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ signal, token: token || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not save feedback.");
      setAccuracy(signal === "yes" || signal === "close" ? "close" : "off");
      setNextCta(d.data?.next_cta || null);
    } catch (err) {
      setError(err.message);
    }
  };

  const flagHeat = async (reason) => {
    if (!activeId) return;
    try {
      await fetch(`${API_BASE}/api/home/${activeId}/heat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason, token: token || undefined }),
      });
    } catch {
      /* non-blocking */
    }
  };

  const enableUpdates = async () => {
    if (!activeId) return;
    try {
      const res = await fetch(`${API_BASE}/api/home/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ value_updates_enabled: true, token: token || undefined }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Could not enable updates.");
      setProfile(d.data.profile);
      setToast("You're set — we'll email monthly value updates.");
    } catch (err) {
      setError(err.message);
    }
  };

  const loginWithPassword = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.success) throw new Error(d.error || "Login failed.");
      await loadHomes();
    } catch (err) {
      setLoginMsg(err.message);
    }
  };

  const magicLink = async (e) => {
    e.preventDefault();
    setLoginMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/alerts/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ email: loginEmail }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.success === false) throw new Error(d.error || "Could not send link.");
      setLoginMsg("Check your email for a secure sign-in link.");
    } catch (err) {
      setLoginMsg(err.message);
    }
  };

  const our = value?.our || null;
  const market = value?.market || null;
  const chart = value?.chart || profile?.chart_series || null;
  const compareLine = value?.compare_line || null;

  const cityTrends = value?.city_trends || null;

  const needsLogin = session === false;
  const loading = session === null;

  const activeHome = useMemo(
    () => homes.find((h) => h.id === activeId) || profile,
    [homes, activeId, profile]
  );

  return (
    <>
      <SEO
        title="My Home Value | SAA Homes"
        description="Your private home value dashboard — multi-source estimates, 10-year history, and seller tools from Adam & Mandi Schwartz."
        canonical="https://saahomes.com/my-home/"
        robots="noindex, nofollow"
      />

      <div className="min-h-[70vh] bg-gradient-to-b from-gray-50 via-white to-white">
        <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--brand-accent)]">
                Seller dashboard
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold font-serif text-gray-900 mt-1">
                My Home
              </h1>
              <p className="text-gray-500 mt-2 text-sm sm:text-base max-w-xl leading-relaxed">
                Stay in front of your home&apos;s value — our MLS data plus licensed market services
                when available. No pressure. Just clarity.
              </p>
            </div>
            <Link
              to="/my-saved-searches/"
              className="shrink-0 text-sm font-semibold text-gray-700 underline underline-offset-2 hover:text-black"
            >
              Saved searches →
            </Link>
          </div>

          {toast && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {toast}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {error}
            </div>
          )}

          {loading && (
            <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 animate-pulse">
              <div className="h-4 w-40 bg-gray-200 rounded" />
              <div className="h-8 w-64 bg-gray-100 rounded mt-3" />
              <div className="h-48 bg-gray-50 rounded-xl mt-6" />
            </div>
          )}

          {/* Login gate */}
          {!loading && needsLogin && (
            <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 max-w-md mx-auto shadow-sm">
              <h2 className="text-xl font-bold text-gray-900">Sign in to view My Home</h2>
              <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                After a market report or account signup, your home value lives here. Sign in with
                your password, or we&apos;ll email a secure link.
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setLoginMode("password")}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-semibold ${
                    loginMode === "password"
                      ? "bg-black text-white border-black"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMode("link")}
                  className={`px-3 py-2.5 rounded-lg border text-sm font-semibold ${
                    loginMode === "link"
                      ? "bg-black text-white border-black"
                      : "border-gray-300 text-gray-600"
                  }`}
                >
                  Email link
                </button>
              </div>
              {loginMode === "password" ? (
                <form onSubmit={loginWithPassword} className="mt-4 space-y-3">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm"
                  >
                    Sign in
                  </button>
                </form>
              ) : (
                <form onSubmit={magicLink} className="mt-4 space-y-3">
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm"
                  >
                    Email me a link
                  </button>
                </form>
              )}
              {loginMsg && <p className="mt-3 text-sm text-gray-600">{loginMsg}</p>}
              <p className="mt-5 text-xs text-gray-400 text-center">
                No account yet?{" "}
                <Link to="/for-sellers/" className="underline font-semibold text-gray-600">
                  Request a free market report
                </Link>{" "}
                or{" "}
                <Link to="/properties/" className="underline font-semibold text-gray-600">
                  save a search
                </Link>
                .
              </p>
            </div>
          )}

          {/* Signed in */}
          {!loading && session && session !== false && (
            <>
              {session.email && (
                <p className="mt-4 text-xs text-gray-500">
                  Signed in as <strong className="text-gray-800">{session.email}</strong>
                  {/* An internal signal for agents; another brokerage's homeowners never see it. */}
                  {session.seller_heat && !bb ? (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 font-semibold">
                      Seller heat
                    </span>
                  ) : null}
                </p>
              )}

              {/* Home value / Selling */}
              <div className="mt-5 inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm" role="tablist" aria-label="My Home view">
                {[
                  ["value", "Home value"],
                  ["seller", sellerPlan ? "Selling" : "Thinking of selling?"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={mode === k}
                    onClick={() => setMode(k)}
                    className={`min-h-[40px] px-4 rounded-lg text-sm font-semibold transition-colors ${
                      mode === k ? "bg-black text-white" : "text-gray-700 hover:text-black"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "seller" && (
                sellerPlan ? (
                  <SellerDashboard
                    plan={sellerPlan}
                    token={token}
                    onPlan={setSellerPlan}
                    agentLine={
                      sellerPlan.agent
                        ? `Your agent: ${[sellerPlan.agent.name, sellerPlan.agent.phone].filter(Boolean).join(" · ")}`
                        : bb
                          ? `Questions? ${[bb.agentName || bb.name, bb.phone].filter(Boolean).join(" · ")}`
                          : `Questions? Adam & Mandi Schwartz · ${AGENT_PHONE}`
                    }
                  />
                ) : sellerPlan === null ? (
                  <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-sm">
                    <h2 className="text-xl font-bold text-gray-900">Thinking of selling?</h2>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-xl">
                      Start a selling plan: ask for a free market analysis, see what&apos;s worth fixing (and what to
                      skip), and follow every step here, from photos to closing. No commitment, and your agent
                      only reaches out to help.
                    </p>
                    <button
                      type="button"
                      onClick={startSelling}
                      disabled={startingPlan}
                      className="mt-5 w-full sm:w-auto min-h-[48px] px-6 rounded-lg text-sm font-bold disabled:opacity-60"
                      style={{ backgroundColor: GOLD, color: "var(--brand-on-accent-ink)" }}
                    >
                      {startingPlan ? "Starting…" : "I'm thinking of selling"}
                    </button>
                  </div>
                ) : (
                  <div className="mt-6 h-40 rounded-2xl border border-gray-200 bg-white animate-pulse" />
                )
              )}

              {mode === "value" && (
              <>
              {/* Home switcher */}
              {homes.length > 1 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {homes.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setActiveId(h.id)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                        activeId === h.id
                          ? "bg-black text-white border-black"
                          : "border-gray-300 text-gray-700 hover:border-black"
                      }`}
                    >
                      {h.address_line}
                      {h.city ? `, ${h.city}` : ""}
                    </button>
                  ))}
                </div>
              )}

              {/* Empty: add home */}
              {!homes.length && !profile && (
                <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-gray-900">Add your home</h2>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {bb ? (
                      <>
                        We&apos;ll estimate a range from live{bb.market ? ` ${bb.market}` : ""} MLS sales data (free),
                        then compare with licensed market services when available. {marketPack.honestLabels.estimate}
                      </>
                    ) : (
                      <>
                    We&apos;ll estimate a range from live {marketPack.market.name} MLS sales data
                    ({marketPack.sources.saaMls}, free), then compare with licensed market
                    services when available. {marketPack.honestLabels.estimate}
                      </>
                    )}
                  </p>
                  <form onSubmit={saveProfile} className="mt-5 space-y-3">
                    <input
                      required
                      value={form.address_line}
                      onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                      placeholder="Street address"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      autoComplete="street-address"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        placeholder="City"
                        className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                        autoComplete="address-level2"
                      />
                      <input
                        value={form.postal_code}
                        onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                        placeholder="ZIP"
                        className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                        autoComplete="postal-code"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <input
                        value={form.living_area}
                        onChange={(e) => setForm({ ...form, living_area: e.target.value })}
                        placeholder="Sqft"
                        inputMode="numeric"
                        className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        value={form.beds}
                        onChange={(e) => setForm({ ...form, beds: e.target.value })}
                        placeholder="Beds"
                        inputMode="decimal"
                        className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      />
                      <input
                        value={form.baths}
                        onChange={(e) => setForm({ ...form, baths: e.target.value })}
                        placeholder="Baths"
                        inputMode="decimal"
                        className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full py-3.5 font-semibold rounded-lg text-sm disabled:opacity-50"
                      style={{ background: GOLD, color: "#111" }}
                    >
                      {saving ? "Estimating…" : "Get my home value estimate"}
                    </button>
                  </form>
                </div>
              )}

              {/* Value dashboard */}
              {(activeHome || profile) && (
                <div className="mt-6 space-y-5">
                  {/* Address + headline compare */}
                  <div className="rounded-2xl bg-black text-white p-5 sm:p-6 shadow-lg">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--brand-accent)]">
                      Current estimated range
                    </p>
                    <h2 className="text-lg sm:text-xl font-semibold mt-1 text-gray-100">
                      {addressLine(profile || activeHome)}
                    </h2>
                    {loadingValue ? (
                      <p className="mt-4 text-sm text-gray-400 animate-pulse">Loading estimates…</p>
                    ) : (
                      <>
                        <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                          <div>
                            <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                              {fmt(our?.mid ?? activeHome?.our_estimate_mid)}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              {fmt(our?.low ?? activeHome?.our_estimate_low)} –{" "}
                              {fmt(our?.high ?? activeHome?.our_estimate_high)}
                            </p>
                          </div>
                          {market?.mid != null && (
                            <div className="pb-1">
                              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                                Market services (estimate)
                              </p>
                              <p className="text-xl font-bold text-[color:var(--brand-accent)]">{fmt(market.mid)}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5 max-w-[12rem] leading-snug">
                                Source:{" "}
                                {market.source ||
                                  marketPack.sources.avmRealtor}
                                {market.attribution
                                  ? ` · ${market.attribution}`
                                  : ` · ${marketPack.honestLabels.notAppraisal}`}
                              </p>
                            </div>
                          )}
                        </div>
                        {compareLine && (
                          <p className="mt-3 text-sm text-gray-300 leading-relaxed border-t border-white/10 pt-3">
                            {compareLine}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                          {our?.label ||
                            activeHome?.our_estimate_label ||
                            marketPack.honestLabels.estimateFallback}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-500 leading-relaxed">
                          Source:{" "}
                          {our?.source_label ||
                            (bb ? `${bb.name} (local MLS data)` : marketPack.sources.saaMls)}{" "}
                          · {marketPack.honestLabels.estimate}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Chart */}
                  <HomeValueChart
                    chart={typeof chart === "string" ? null : chart}
                    ourRange={
                      our?.mid != null
                        ? { low: our.low, mid: our.mid, high: our.high }
                        : activeHome?.our_estimate_mid != null
                          ? {
                              low: activeHome.our_estimate_low,
                              mid: activeHome.our_estimate_mid,
                              high: activeHome.our_estimate_high,
                            }
                          : null
                    }
                    market={market}
                  />

                  {(profile || activeHome)?.id && (
                    <CompsWorkbench homeId={(profile || activeHome).id} authQ={authQ} />
                  )}

                  <RecentClosedSales
                    city={(profile || activeHome)?.city}
                    postalCode={(profile || activeHome)?.postal_code}
                  />

                  {/* City trends (if present) */}
                  {cityTrends && (cityTrends.zhvi || cityTrends.median_sale) && (
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                        {cityTrends.location} market snapshot
                      </p>
                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {cityTrends.zhvi != null && (
                          <div>
                            <p className="text-[10px] uppercase text-gray-400 font-semibold">ZHVI</p>
                            <p className="text-sm font-bold">{fmt(cityTrends.zhvi)}</p>
                          </div>
                        )}
                        {cityTrends.median_sale != null && (
                          <div>
                            <p className="text-[10px] uppercase text-gray-400 font-semibold">
                              Med sale
                            </p>
                            <p className="text-sm font-bold">{fmt(cityTrends.median_sale)}</p>
                          </div>
                        )}
                        {cityTrends.inventory != null && (
                          <div>
                            <p className="text-[10px] uppercase text-gray-400 font-semibold">
                              Inventory
                            </p>
                            <p className="text-sm font-bold">{cityTrends.inventory}</p>
                          </div>
                        )}
                        {cityTrends.days_to_pending != null && (
                          <div>
                            <p className="text-[10px] uppercase text-gray-400 font-semibold">DTP</p>
                            <p className="text-sm font-bold">{cityTrends.days_to_pending} days</p>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-[11px] text-gray-400">
                        {cityTrends.attribution ||
                          `City-level index (estimate) · ${marketPack.sources.avmZillow} · not a per-home appraisal.`}
                      </p>
                    </div>
                  )}

                  {/* CHFA / DPA trusted resource (from market pack): SAA's Colorado page, not another brokerage's. */}
                  {!bb && (
                  <p className="text-xs text-gray-500 leading-relaxed px-0.5">
                    {marketPack.dpa.chfaLine}{" "}
                    <Link
                      to={marketPack.dpa.hubPath}
                      className="font-semibold text-gray-700 underline underline-offset-2 hover:text-black"
                    >
                      Learn about CHFA DPA
                    </Link>
                  </p>
                  )}

                  {/* One-two ask */}
                  <div className="rounded-2xl border-2 border-[rgb(var(--brand-accent-rgb)/0.4)] p-5">
                    <p className="text-sm font-bold text-gray-900">Is this estimate close?</p>
                    <p className="text-xs text-gray-500 mt-1">
                      One tap helps us guide you to the right next step — no sales pitch.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => sendAccuracy("close")}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          accuracy === "close"
                            ? "bg-black text-white border-black"
                            : "bg-white border-gray-300 text-gray-800 hover:border-black"
                        }`}
                      >
                        Yes, roughly
                      </button>
                      <button
                        type="button"
                        onClick={() => sendAccuracy("off")}
                        className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                          accuracy === "off"
                            ? "bg-black text-white border-black"
                            : "bg-white border-gray-300 text-gray-800 hover:border-black"
                        }`}
                      >
                        No, it&apos;s off
                      </button>
                    </div>
                    {nextCta && (
                      <a
                        href={nextCta.href}
                        onClick={() => {
                          if (nextCta.action === "market_analysis") flagHeat("market_analysis_cta");
                        }}
                        className="mt-4 flex items-center justify-center w-full py-3.5 rounded-xl text-sm font-bold text-black"
                        style={{ background: GOLD }}
                      >
                        {nextCta.primary}
                      </a>
                    )}
                  </div>

                  {/* Seller actions */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">What do you want to know?</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Mapped to the questions sellers actually ask.
                    </p>
                    <div className="mt-4 space-y-2.5">
                      {sellerActions.map((a) => {
                        const onClick = async (e) => {
                          if (a.heat) {
                            e.preventDefault();
                            await flagHeat("market_analysis_request");
                            window.location.href = a.href;
                            return;
                          }
                          if (a.action === "enable_updates") {
                            e.preventDefault();
                            await enableUpdates();
                          }
                        };
                        const Comp = a.href && a.action !== "enable_updates" ? "a" : "button";
                        const props =
                          Comp === "a"
                            ? { href: a.href, onClick }
                            : { type: "button", onClick };
                        return (
                          <Comp
                            key={a.key}
                            {...props}
                            // `block`: as a plain inline <a>, the card's border and padding broke around its lines and ran off the left edge on phones.
                            className={`block w-full text-left rounded-xl border px-4 py-3.5 transition-colors hover:border-black ${
                              a.primary
                                ? "bg-black text-white border-black"
                                : "bg-white border-gray-200 text-gray-900"
                            }`}
                          >
                            <p
                              className={`text-[10px] font-bold uppercase tracking-wide ${
                                a.primary ? "text-[color:var(--brand-accent)]" : "text-gray-400"
                              }`}
                            >
                              {a.question}
                            </p>
                            <p className="text-sm font-semibold mt-0.5">{a.cta}</p>
                            {a.sub && (
                              <p
                                className={`text-xs mt-0.5 ${
                                  a.primary ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                {a.sub}
                              </p>
                            )}
                          </Comp>
                        );
                      })}
                    </div>
                  </div>

                  {/* Value updates status */}
                  {(profile || activeHome) && (
                    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600 flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Monthly value emails:{" "}
                        <strong>
                          {(profile || activeHome).value_updates_enabled !== false
                            ? "On"
                            : "Off"}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const on = (profile || activeHome).value_updates_enabled !== false;
                          await fetch(`${API_BASE}/api/home/${activeId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            credentials: "same-origin",
                            body: JSON.stringify({
                              value_updates_enabled: !on,
                              token: token || undefined,
                            }),
                          });
                          await loadValue(activeId);
                          setToast(on ? "Value emails paused." : "Value emails enabled.");
                        }}
                        className="font-semibold underline text-gray-800"
                      >
                        {(profile || activeHome).value_updates_enabled !== false
                          ? "Turn off"
                          : "Turn on"}
                      </button>
                    </div>
                  )}

                  {value?.disclaimer && (
                    <p className="text-[11px] text-gray-400 leading-relaxed">{value.disclaimer}</p>
                  )}

                  {/* Add another home */}
                  <details className="rounded-xl border border-gray-200 bg-white p-4">
                    <summary className="text-sm font-semibold cursor-pointer">
                      Add or update a home
                    </summary>
                    <form onSubmit={saveProfile} className="mt-4 space-y-3">
                      <input
                        required
                        value={form.address_line}
                        onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                        placeholder="Street address"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          value={form.city}
                          onChange={(e) => setForm({ ...form, city: e.target.value })}
                          placeholder="City"
                          className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                        />
                        <input
                          value={form.postal_code}
                          onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                          placeholder="ZIP"
                          className="px-4 py-3 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <input
                        value={form.living_area}
                        onChange={(e) => setForm({ ...form, living_area: e.target.value })}
                        placeholder="Living area (sqft)"
                        inputMode="numeric"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save home"}
                      </button>
                    </form>
                  </details>
                </div>
              )}
              </>
              )}

              {/* Stay in touch emails (after a closing) */}
              {stay?.has_closing && stay.kinds?.length > 0 && (
                <section id="emails" className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm scroll-mt-24">
                  <h2 className="text-lg font-bold text-gray-900">Your emails</h2>
                  <p className="mt-1 text-sm text-gray-500">A few notes a year about your home. Turn off any you don&apos;t want.</p>
                  <ul className="mt-4 divide-y divide-gray-100">
                    {stay.kinds.map((k) => (
                      <li key={k.kind} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{k.label}</p>
                          {k.off_by_agent && <p className="text-xs text-gray-500">Paused by your agent</p>}
                          {k.kind === "rate" && !stay.rate_source && <p className="text-xs text-gray-500">Starts once rate data is connected</p>}
                        </div>
                        <label className="relative inline-flex shrink-0 cursor-pointer items-center min-h-[44px]">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={!!k.on}
                            disabled={k.off_by_agent || !stay.stay_in_touch}
                            onChange={(e) => setStayKind(k.kind, e.target.checked)}
                            aria-label={`${k.label} emails`}
                          />
                          <span className="h-6 w-11 rounded-full bg-gray-300 transition-colors peer-checked:bg-[color:var(--brand-accent)] peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-[color:var(--brand-accent)]" />
                          <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                        </label>
                      </li>
                    ))}
                  </ul>
                  {stay.rate_source && stay.kinds.some((k) => k.kind === "rate" && k.on) && (
                    <form
                      className="mt-3 flex flex-wrap items-end gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        setStayKind(null, e.currentTarget.elements.target_rate.value);
                        setToast("Saved. We'll email you if rates reach it.");
                      }}
                    >
                      <label className="text-sm text-gray-700">
                        Tell me when 30-year rates reach
                        <input
                          name="target_rate"
                          inputMode="decimal"
                          defaultValue={stay.target_rate ?? ""}
                          placeholder="5.5"
                          className="ml-2 w-20 min-h-[40px] rounded-lg border border-gray-300 px-2 text-sm"
                        />
                        <span className="ml-1">%</span>
                      </label>
                      <button type="submit" className="min-h-[40px] px-4 rounded-lg border border-gray-300 text-sm font-semibold">Save</button>
                    </form>
                  )}
                </section>
              )}
            </>
          )}

          <p className="mt-10 text-center text-xs text-gray-400">
            {bb ? (
              [bb.legalName || bb.name, bb.phone, marketPack.fairHousing, marketPack.honestLabels.notAppraisal]
                .filter(Boolean)
                .join(" · ")
            ) : (
              <>
            {marketPack.market.brokerage} · {AGENT_PHONE} · {marketPack.fairHousing} ·{" "}
            {marketPack.honestLabels.notAppraisal}
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
