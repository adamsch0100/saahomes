import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { submitMarketReportForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";
import HomeValueChart from "./HomeValueChart.jsx";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const fmt = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  if (v >= 1000000) return `$${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 2)}M`;
  return `$${Math.round(v).toLocaleString()}`;
};

/**
 * HomeValueCapture — the "Get Your Home Value" advanced lead-capture flow.
 * Step 1: address only (zero friction) → instant our-comps range via /api/home/estimate
 * Step 2: email + phone gate (one-two ask: is this close?) → /api/market-report
 *         creates the user + auth cookie + home profile + seller heat + FUB/GA4
 * Step 3: full multi-source report (Zillow/Realtor/Redfin AVMs + 10-yr chart)
 *         via /api/home/:id/value → link to /my-home/
 */
export default function HomeValueCapture({ areaName = "Northern Colorado" }) {
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [addr, setAddr] = useState({ address_line: "", city: "", postal_code: "", living_area: "" });
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [estimateError, setEstimateError] = useState(null);
  const [gate, setGate] = useState({ firstName: "", lastName: "", email: "", phone: "", accuracy: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [value, setValue] = useState(null);
  const [valueLoading, setValueLoading] = useState(false);
  const [valueError, setValueError] = useState(null);

  const setAddrField = (k) => (e) => setAddr((p) => ({ ...p, [k]: e.target.value }));

  const getEstimate = async (e) => {
    e.preventDefault();
    setEstimating(true);
    setEstimateError(null);
    try {
      const res = await fetch(`${API_BASE}/api/home/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address_line: addr.address_line,
          city: addr.city,
          postal_code: addr.postal_code,
          living_area: addr.living_area ? Number(addr.living_area) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not estimate your home's value.");
      setEstimate(data.data);
      setStep(2);
    } catch (err) {
      setEstimateError(err.message);
    } finally {
      setEstimating(false);
    }
  };

  const submitGate = async (e) => {
    e.preventDefault();
    if (!gate.email || !gate.phone) {
      setSubmitError("Email and phone are required so we can send your report.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // The market-report flow creates the user (auth cookie), home profile,
      // seller heat, FUB + GA4 — the lead-capture gate.
      const result = await submitMarketReportForm(
        withLeadMetadata(
          {
            ...gate,
            area: areaName,
            address_line: addr.address_line,
            postal_code: addr.postal_code,
            city: addr.city || areaName,
            living_area: addr.living_area ? Number(addr.living_area) : undefined,
          },
          location.pathname
        )
      );
      const id = result?.home_profile_id;
      if (!id) throw new Error("Your home profile could not be created. Please try again.");
      setProfileId(id);
      setStep(3);
      loadFullValue(id);
    } catch (err) {
      setSubmitError(err.message || "Failed to save. Please try again.");
      setSubmitting(false);
    }
  };

  const loadFullValue = async (id) => {
    setValueLoading(true);
    setValueError(null);
    try {
      const res = await fetch(`${API_BASE}/api/home/${id}/value?avm=1&chart=1`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Could not load the full report.");
      setValue(data.data);
    } catch (err) {
      setValueError(err.message);
    } finally {
      setValueLoading(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3.5 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none bg-white";
  const labelCls = "block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5";

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden" id="home-value-capture">
      {/* Step indicator */}
      <div className="flex items-center gap-2 px-5 sm:px-6 pt-5 pb-1">
        {["Your address", "Your details", "Your report"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <div key={label} className="flex items-center gap-2">
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                  done ? "bg-black text-white" : active ? "bg-[#CFB36E] text-black" : "bg-gray-100 text-gray-400"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`text-xs font-semibold ${active || done ? "text-gray-900" : "text-gray-400"}`}>
                {label}
              </span>
              {n < 3 && <span className="w-4 h-px bg-gray-200" />}
            </div>
          );
        })}
      </div>

      <div className="p-5 sm:p-8">
        {/* STEP 1 — address */}
        {step === 1 && (
          <form onSubmit={getEstimate} className="space-y-4">
            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900">What's your home worth today?</h3>
              <p className="text-sm text-gray-500 mt-1.5">
                Enter your address for an instant estimate from live Northern Colorado sales data. No account needed.
              </p>
            </div>
            <div>
              <label className={labelCls}>Street address</label>
              <input className={inputCls} value={addr.address_line} onChange={setAddrField("address_line")} placeholder="1234 Oak Street" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>City</label>
                <input className={inputCls} value={addr.city} onChange={setAddrField("city")} placeholder="Fort Collins" required />
              </div>
              <div>
                <label className={labelCls}>ZIP</label>
                <input className={inputCls} value={addr.postal_code} onChange={setAddrField("postal_code")} placeholder="80525" required />
              </div>
            </div>
            <div>
              <label className={labelCls}>
                Square feet <span className="normal-case font-normal text-gray-400">(optional — improves accuracy)</span>
              </label>
              <input className={inputCls} value={addr.living_area} onChange={setAddrField("living_area")} placeholder="2,200" inputMode="numeric" />
            </div>
            {estimateError && <p className="text-sm text-red-600">{estimateError}</p>}
            <button
              type="submit"
              disabled={estimating}
              className="w-full min-h-[48px] bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold rounded-lg transition-colors disabled:opacity-60"
            >
              {estimating ? "Estimating…" : "Get My Estimate — Free"}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Estimated range based on live MLS sales data — never a fake number.
            </p>
          </form>
        )}

        {/* STEP 2 — the gate (lead capture) */}
        {step === 2 && (
          <form onSubmit={submitGate} className="space-y-4">
            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900">Your estimate</h3>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {estimate?.compare_line || "Estimated range available."}
              </p>
              {estimate?.our?.mid != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Estimated range based on {estimate?.our?.label || "live sales data"}, updated monthly.
                </p>
              )}
            </div>

            {/* One-two ask */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-900">Is this estimate close to what you expected?</p>
              <div className="mt-3 flex gap-2">
                {[
                  { v: "yes", label: "Yes, roughly" },
                  { v: "no", label: "No, it's off" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    onClick={() => setGate((p) => ({ ...p, accuracy: o.v }))}
                    className={`flex-1 min-h-[44px] rounded-lg border text-sm font-semibold transition-colors ${
                      gate.accuracy === o.v
                        ? "bg-black text-white border-black"
                        : "bg-white text-gray-700 border-gray-300 hover:border-black"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>First name</label>
                <input className={inputCls} value={gate.firstName} onChange={(e) => setGate((p) => ({ ...p, firstName: e.target.value }))} required />
              </div>
              <div>
                <label className={labelCls}>Last name</label>
                <input className={inputCls} value={gate.lastName} onChange={(e) => setGate((p) => ({ ...p, lastName: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={gate.email} onChange={(e) => setGate((p) => ({ ...p, email: e.target.value }))} placeholder="you@email.com" required />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" className={inputCls} value={gate.phone} onChange={(e) => setGate((p) => ({ ...p, phone: e.target.value }))} placeholder="(970) 555-1234" required />
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Unlock the full multi-source report — what Zillow, Realtor.com, Redfin and our own data say — plus a
              10-year value chart and monthly updates. No spam, unsubscribe anytime.
            </p>
            {submitError && <p className="text-sm text-red-600">{submitError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[48px] bg-[#CFB36E] hover:bg-[#c0a55e] text-black font-bold rounded-lg transition-colors disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Unlock My Full Report — Free"}
            </button>
          </form>
        )}

        {/* STEP 3 — full multi-source report */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h3 className="text-2xl font-serif font-bold text-gray-900">Your home value report</h3>
              <p className="text-sm text-gray-500 mt-1">Saved to your dashboard — multi-source, honest, updated monthly.</p>
            </div>

            {valueLoading && <p className="text-sm text-gray-500">Loading the full picture…</p>}
            {valueError && <p className="text-sm text-red-600">{valueError}</p>}

            {value && (
              <>
                {/* Our range */}
                {value?.value?.our?.mid != null && (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Our data says</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {fmt(value.value.our.low)} – {fmt(value.value.our.high)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Estimated range based on {value.value.our.label || "live sales data"}. Not an appraisal.
                    </p>
                  </div>
                )}

                {/* Chart */}
                {value?.value?.chart && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">10-year value trend</p>
                    <HomeValueChart
                      chart={typeof value.value.chart === "string" ? null : value.value.chart}
                      ourRange={
                        value.value.our?.mid != null
                          ? { low: value.value.our.low, mid: value.value.our.mid, high: value.value.our.high }
                          : null
                      }
                      market={value.value.market}
                    />
                  </div>
                )}

                {/* Personalized CTA from the one-two ask */}
                <div className="rounded-xl bg-black text-white p-5">
                  <p className="text-sm font-semibold">
                    {gate.accuracy === "no"
                      ? "Let's get the real number — a full market analysis from a local agent."
                      : "Want to see what you'd actually net? Let's talk through your options."}
                  </p>
                  <Link
                    to="/contact/?interest=Selling a home"
                    className="mt-4 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-[#CFB36E] hover:bg-[#c0a55e] text-black text-sm font-bold rounded-lg transition-colors"
                  >
                    Talk to Adam & Mandi — Free, No Pressure
                  </Link>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/my-home/"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 bg-black text-white text-sm font-bold rounded-lg hover:opacity-80 transition-opacity"
                  >
                    View on My Home →
                  </Link>
                  <Link
                    to="/for-sellers/"
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-lg hover:border-black transition-colors"
                  >
                    How We Sell Homes
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
