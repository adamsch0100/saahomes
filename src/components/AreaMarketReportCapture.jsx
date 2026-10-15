import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { submitMarketReportForm } from "../utils/api.js";
import { withLeadMetadata } from "../utils/leadTracking.js";

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none";
const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

/**
 * AreaMarketReportCapture — the above-the-fold capture block for a city page.
 * One ask: the free market report. Four fields go straight to /api/market-report,
 * which stores a market_report_submissions row and notifies the team.
 *
 * The stored source_page carries `?capture=<label>` so a labeled submit reads
 * back as a row that names this block.
 */
export default function AreaMarketReportCapture({
  areaName = "Northern Colorado",
  captureLabel = "area-above-fold",
}) {
  const location = useLocation();
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);

  const setField = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setStatus(null);
    try {
      const sourcePage = `${location.pathname}?capture=${captureLabel}`;
      await submitMarketReportForm(
        withLeadMetadata({ ...form, area: areaName }, sourcePage)
      );
      setStatus({ type: "success" });
      setForm({ firstName: "", lastName: "", email: "", phone: "" });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Could not send the report. Please try again." });
    } finally {
      setSending(false);
    }
  };

  if (status?.type === "success") {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-6 text-center" id="area-market-report-capture">
        <p className="text-lg font-bold text-gray-900">Your {areaName} market report is on the way.</p>
        <p className="mt-2 text-sm text-gray-600">
          Check your inbox shortly. Prefer to talk now? Call{" "}
          <a href="tel:(970) 999-1407" className="font-semibold text-black hover:underline">(970) 999-1407</a>.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-6" id="area-market-report-capture">
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Free {areaName} market report</h2>
      <p className="mt-1.5 text-sm text-gray-600">
        Current prices, days on market, and what nearby homes sold for. Sent to your email.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cap-firstName" className={labelCls}>First name</label>
            <input
              id="cap-firstName"
              name="firstName"
              type="text"
              required
              autoComplete="given-name"
              value={form.firstName}
              onChange={setField("firstName")}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="cap-lastName" className={labelCls}>Last name</label>
            <input
              id="cap-lastName"
              name="lastName"
              type="text"
              required
              autoComplete="family-name"
              value={form.lastName}
              onChange={setField("lastName")}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label htmlFor="cap-email" className={labelCls}>Email</label>
          <input
            id="cap-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            value={form.email}
            onChange={setField("email")}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="cap-phone" className={labelCls}>Phone</label>
          <input
            id="cap-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            onChange={setField("phone")}
            className={inputCls}
          />
        </div>
        {status?.type === "error" && <p className="text-sm text-red-600">{status.message}</p>}
        <button
          type="submit"
          disabled={sending}
          className="w-full min-h-[48px] bg-black text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
        >
          {sending ? "Sending…" : "Get My Free Market Report"}
        </button>
      </form>
      <p className="mt-3 text-[11px] text-gray-500 text-center">
        No spam. Unsubscribe anytime. Or call{" "}
        <a href="tel:(970) 999-1407" className="font-semibold text-gray-700 hover:underline">(970) 999-1407</a>.
      </p>
    </div>
  );
}
