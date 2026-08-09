/**
 * Agent cockpit — Adam's daily lead pane.
 * Columns: lead score · heat 🔥 · lifecycle stage · next-touch due.
 * "Due today" queue from cadence + signals. Mobile-usable (touch targets).
 * Auth via admin token; page is noindex (set by AdminPage SEO).
 */
import React, { useCallback, useEffect, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const STAGES = [
  { value: "all", label: "All stages" },
  { value: "new", label: "New" },
  { value: "nurturing", label: "Nurturing" },
  { value: "showing", label: "Showing" },
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
];

const STAGE_STYLE = {
  new: "bg-slate-100 text-slate-700",
  nurturing: "bg-blue-50 text-blue-800",
  showing: "bg-amber-50 text-amber-900",
  active: "bg-emerald-50 text-emerald-800",
  closed: "bg-gray-200 text-gray-700",
  lost: "bg-red-50 text-red-800",
};

function scoreColor(score) {
  if (score >= 50) return "text-emerald-700 bg-emerald-50";
  if (score >= 25) return "text-amber-800 bg-amber-50";
  return "text-gray-700 bg-gray-100";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const GOLD = "#CFB36E";

/** Format share-home API result into honest status lines for the agent. */
function formatShareResult(data) {
  if (!data) return null;
  const lines = [];
  const fub = data.fubStatus || {};
  if (fub.success) {
    lines.push("FUB event sent (source saahomes.com)");
  } else if (fub.reason === "not_configured") {
    lines.push("FUB not configured — event skipped (no fake success)");
  } else if (fub.reason === "no_email") {
    lines.push("FUB skipped — invalid email");
  } else {
    lines.push(`FUB: ${fub.error || fub.reason || "failed"}`);
  }
  if (data.eventStatus === "recorded") {
    lines.push("Recorded on cockpit timeline");
  } else if (data.eventStatus === "skipped_no_account") {
    lines.push("Timeline skipped — no matching account for that email");
  } else if (data.eventStatus === "failed") {
    lines.push("Timeline write failed");
  }
  if (data.notificationStatus === "delivered") {
    lines.push("Client notification delivered");
  } else if (data.notificationStatus === "skipped_no_account") {
    lines.push("Notification skipped — client has no account");
  } else if (data.notificationStatus === "failed") {
    lines.push("Notification create failed");
  }
  return lines;
}

/** Share-home form — module scope so inputs keep focus across re-renders. */
function ShareHomeForm({
  lead,
  open,
  listing,
  email,
  note,
  busy,
  error,
  result,
  onListingChange,
  onEmailChange,
  onNoteChange,
  onClose,
  onSubmit,
}) {
  if (!open || !lead) return null;
  const resultLines = formatShareResult(result);
  return (
    <div
      className="mt-3 rounded-lg border p-3 space-y-3"
      style={{ borderColor: `${GOLD}66`, backgroundColor: `${GOLD}0d` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">Share a home</p>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-800 min-h-[36px] px-2"
        >
          Close
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Paste a listing URL, slug, or MLS#. Home facts come from the live feed only.
      </p>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Listing (URL, slug, or MLS#)</span>
        <input
          type="text"
          value={listing}
          onChange={(e) => onListingChange(e.target.value)}
          placeholder="e.g. https://saahomes.com/homes-for-sale/… or MLS#"
          className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={busy}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Recipient email</span>
        <input
          type="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          disabled={busy}
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Note (optional)</span>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Why this home fits them…"
          className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-y"
          disabled={busy}
        />
      </label>
      <button
        type="button"
        disabled={busy || !listing.trim() || !email.trim()}
        onClick={onSubmit}
        className="w-full min-h-[44px] px-4 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
        style={{ backgroundColor: GOLD }}
      >
        {busy ? "Sending…" : "Send"}
      </button>
      {error && (
        <div className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {result?.success && (
        <div className="text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 space-y-1">
          <p className="font-semibold text-emerald-800">Shared successfully</p>
          {result.listing?.property_address && (
            <p className="text-xs text-gray-600">
              {result.listing.property_address}
              {result.listing.list_price != null
                ? ` · $${Number(result.listing.list_price).toLocaleString("en-US")}`
                : ""}
              {result.listing.off_market ? " · off market" : ""}
            </p>
          )}
          {resultLines && (
            <ul className="list-disc pl-4 text-xs text-gray-600 space-y-0.5">
              {resultLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentCockpit({ token }) {
  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState(null);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fubStatus, setFubStatus] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  // Share-home form (It 16 / P5) — one lead at a time
  const [shareLeadId, setShareLeadId] = useState(null);
  const [shareListing, setShareListing] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareNote, setShareNote] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [shareResult, setShareResult] = useState(null);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const openShareForm = (lead) => {
    setShareLeadId(lead.id);
    setShareEmail(lead.email || "");
    setShareListing("");
    setShareNote("");
    setShareError(null);
    setShareResult(null);
    setExpanded(lead.id);
  };

  const closeShareForm = () => {
    setShareLeadId(null);
    setShareListing("");
    setShareNote("");
    setShareError(null);
    setShareResult(null);
  };

  const submitShareHome = async (lead) => {
    setShareBusy(true);
    setShareError(null);
    setShareResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/share-home`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          email: (shareEmail || lead.email || "").trim(),
          name: lead.name || undefined,
          phone: lead.phone || undefined,
          listingKeyOrSlug: shareListing.trim(),
          note: shareNote.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Share failed (${res.status})`);
      }
      setShareResult(data);
    } catch (err) {
      setShareError(err.message || "Could not share home");
    } finally {
      setShareBusy(false);
    }
  };

  const shareFormProps = (lead) => ({
    lead,
    open: shareLeadId === lead.id,
    listing: shareListing,
    email: shareEmail,
    note: shareNote,
    busy: shareBusy,
    error: shareError,
    result: shareResult,
    onListingChange: setShareListing,
    onEmailChange: setShareEmail,
    onNoteChange: setShareNote,
    onClose: closeShareForm,
    onSubmit: () => submitShareHome(lead),
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (stage && stage !== "all") params.set("stage", stage);
      if (dueOnly) params.set("due", "today");
      params.set("limit", "100");

      const [cockpitRes, fubRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/cockpit?${params}`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/fub/status`, { headers }).then((r) => r.json()).catch(() => null),
      ]);
      if (!cockpitRes.success) throw new Error(cockpitRes.error || "Failed to load cockpit");
      setLeads(cockpitRes.data || []);
      setMeta(cockpitRes.meta || null);
      if (fubRes?.success) setFubStatus(fubRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [q, stage, dueOnly, token]);

  useEffect(() => {
    load();
  }, [load]);

  const patchLead = async (id, body) => {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/cockpit/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, ...data.data } : l)));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Leads shown</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{meta?.total ?? "—"}</p>
        </div>
        <button
          type="button"
          onClick={() => setDueOnly((v) => !v)}
          className={`text-left rounded-xl border p-4 shadow-sm transition-colors min-h-[72px] ${
            dueOnly
              ? "bg-black text-white border-black"
              : "bg-white border-gray-200 hover:border-black"
          }`}
        >
          <p className={`text-xs font-medium uppercase tracking-wide ${dueOnly ? "text-gray-300" : "text-gray-500"}`}>
            Due today
          </p>
          <p className="text-2xl font-bold mt-1">{meta?.due_today ?? "—"}</p>
        </button>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hot 🔥</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{meta?.hot ?? "—"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">FUB CRM</p>
          <p className="text-sm font-semibold text-gray-900 mt-2">
            {fubStatus == null
              ? "…"
              : fubStatus.configured
                ? fubStatus.success !== false
                  ? `Live · ${fubStatus.total != null ? `${fubStatus.total} people` : "connected"}`
                  : "Key set · check failed"
                : "Not configured"}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="flex-1 min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            className="min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            {STAGES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="min-h-[44px] px-5 py-2 rounded-lg bg-black text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
        {dueOnly && (
          <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Showing follow-up queue for <strong>today</strong> (including overdue), sorted by heat then score.
            Tap the Due today card again to clear.
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Desktop table + mobile cards */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && leads.length === 0 && (
          <div className="p-10 text-center text-gray-500">Loading cockpit…</div>
        )}
        {!loading && leads.length === 0 && (
          <div className="p-10 text-center text-gray-500">
            No leads match. Try clearing filters or check that users exist in the database.
          </div>
        )}

        {leads.length > 0 && (
          <>
            {/* Mobile card list */}
            <ul className="md:hidden divide-y divide-gray-100">
              {leads.map((lead) => (
                <li key={lead.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {lead.is_hot && <span className="mr-1" title={`${lead.heat_count} high-intent events in 7d`}>🔥</span>}
                        {lead.name || "—"}
                      </p>
                      <a href={`mailto:${lead.email}`} className="text-sm text-blue-700 break-all">
                        {lead.email}
                      </a>
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="block text-sm text-gray-600 mt-0.5">
                          {lead.phone}
                        </a>
                      )}
                    </div>
                    <span className={`shrink-0 text-sm font-bold px-2.5 py-1 rounded-full ${scoreColor(lead.lead_score)}`}>
                      {lead.lead_score ?? 0}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <select
                      value={lead.lifecycle_stage || "new"}
                      disabled={savingId === lead.id}
                      onChange={(e) => patchLead(lead.id, { lifecycle_stage: e.target.value })}
                      className={`min-h-[40px] text-xs font-semibold rounded-full px-3 border-0 ${STAGE_STYLE[lead.lifecycle_stage] || STAGE_STYLE.new}`}
                    >
                      {STAGES.filter((s) => s.value !== "all").map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                    <span className={`text-xs px-2 py-1 rounded ${lead.is_overdue ? "bg-red-50 text-red-700" : lead.is_due_today ? "bg-amber-50 text-amber-900" : "bg-gray-50 text-gray-600"}`}>
                      Next: {formatDate(lead.next_touch_at)}
                      {lead.is_overdue ? " · overdue" : lead.is_due_today ? " · due" : ""}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="date"
                      value={toDateInputValue(lead.next_touch_at)}
                      disabled={savingId === lead.id}
                      onChange={(e) =>
                        patchLead(lead.id, {
                          next_touch_at: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null,
                        })
                      }
                      className="min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={savingId === lead.id}
                      onClick={() => patchLead(lead.id, { mark_touched: true })}
                      className="min-h-[40px] px-3 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-black disabled:opacity-50"
                    >
                      Mark touched
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                      className="min-h-[40px] px-3 rounded-lg border border-gray-300 text-sm text-gray-700"
                    >
                      {expanded === lead.id ? "Hide signals" : "Signals"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openShareForm(lead)}
                      className="min-h-[40px] px-3 rounded-lg text-sm font-semibold text-black border"
                      style={{ borderColor: GOLD, backgroundColor: `${GOLD}22` }}
                    >
                      Share a home
                    </button>
                  </div>
                  {expanded === lead.id && (
                    <div className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 space-y-1">
                      <p>Searches: {lead.search_count ?? 0} · Homes: {lead.home_count ?? 0}</p>
                      <p>FUB person: {lead.fub_person_id || "not linked yet"}</p>
                      <p>Last active: {formatDateTime(lead.last_active_at)}</p>
                      {(lead.heat_signals || []).length === 0 ? (
                        <p className="text-gray-400">No high-intent events in 7d</p>
                      ) : (
                        <ul className="list-disc pl-4">
                          {lead.heat_signals.map((s, i) => (
                            <li key={i}>{s.type}{s.detail ? ` — ${s.detail}` : ""} · {formatDateTime(s.at)}</li>
                          ))}
                        </ul>
                      )}
                      <ShareHomeForm {...shareFormProps(lead)} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Heat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next touch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <React.Fragment key={lead.id}>
                      <tr className={`hover:bg-gray-50 ${lead.is_due_today ? "bg-amber-50/40" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">
                            {lead.name || "—"}
                            {lead.seller_heat && (
                              <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded">
                                seller
                              </span>
                            )}
                          </div>
                          <a href={`mailto:${lead.email}`} className="text-blue-700 hover:underline">
                            {lead.email}
                          </a>
                          {lead.phone && (
                            <div className="text-gray-500">
                              <a href={`tel:${lead.phone}`} className="hover:underline">{lead.phone}</a>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-0.5">
                            {lead.search_count ? `${lead.search_count} search${lead.search_count === 1 ? "" : "es"}` : "no searches"}
                            {lead.fub_person_id ? ` · FUB #${lead.fub_person_id}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-full font-bold ${scoreColor(lead.lead_score)}`}>
                            {lead.lead_score ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {lead.is_hot ? (
                            <button
                              type="button"
                              title={`${lead.heat_count} high-intent events in 7 days`}
                              onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                              className="text-lg leading-none"
                            >
                              🔥 <span className="text-xs font-semibold text-gray-600">{lead.heat_count}</span>
                            </button>
                          ) : (
                            <span className="text-gray-300" title={`${lead.heat_count || 0} events in 7d`}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={lead.lifecycle_stage || "new"}
                            disabled={savingId === lead.id}
                            onChange={(e) => patchLead(lead.id, { lifecycle_stage: e.target.value })}
                            className={`min-h-[36px] text-xs font-semibold rounded-full px-3 border border-transparent cursor-pointer ${STAGE_STYLE[lead.lifecycle_stage] || STAGE_STYLE.new}`}
                          >
                            {STAGES.filter((s) => s.value !== "all").map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          {lead.lifecycle_stage_manual && (
                            <div className="text-[10px] text-gray-400 mt-0.5">manual</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={toDateInputValue(lead.next_touch_at)}
                            disabled={savingId === lead.id}
                            onChange={(e) =>
                              patchLead(lead.id, {
                                next_touch_at: e.target.value
                                  ? new Date(`${e.target.value}T12:00:00`).toISOString()
                                  : null,
                              })
                            }
                            className="min-h-[36px] border border-gray-300 rounded-lg px-2 text-sm"
                          />
                          {(lead.is_overdue || lead.is_due_today) && (
                            <div className={`text-[10px] font-semibold mt-0.5 ${lead.is_overdue ? "text-red-600" : "text-amber-700"}`}>
                              {lead.is_overdue ? "Overdue" : "Due today"}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              disabled={savingId === lead.id}
                              onClick={() => patchLead(lead.id, { mark_touched: true })}
                              className="min-h-[36px] px-3 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-black disabled:opacity-50"
                            >
                              {savingId === lead.id ? "…" : "Mark touched"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}
                              className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-xs text-gray-700 hover:border-black"
                            >
                              Signals
                            </button>
                            <button
                              type="button"
                              onClick={() => openShareForm(lead)}
                              className="min-h-[36px] px-3 rounded-lg text-xs font-semibold text-black border hover:opacity-90"
                              style={{ borderColor: GOLD, backgroundColor: `${GOLD}22` }}
                            >
                              Share a home
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expanded === lead.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={6} className="px-4 py-3 text-xs text-gray-600">
                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                              <span>Last active: {formatDateTime(lead.last_active_at)}</span>
                              <span>Last touched: {formatDateTime(lead.last_touched_at)}</span>
                              <span>Joined: {formatDate(lead.created_at)}</span>
                              <span>Intent: {lead.intent || "—"}</span>
                            </div>
                            {(lead.heat_signals || []).length > 0 ? (
                              <ul className="mt-2 list-disc pl-5 space-y-0.5">
                                {lead.heat_signals.map((s, i) => (
                                  <li key={i}>
                                    <strong>{s.type}</strong>
                                    {s.detail ? ` — ${s.detail}` : ""} · {formatDateTime(s.at)}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-gray-400">No high-intent events in the last 7 days.</p>
                            )}
                            <ShareHomeForm {...shareFormProps(lead)} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center px-2">
        Scores and heat are derived from real activity only (saved searches, showings, views, market analysis).
        FUB is source of truth — nurture signals write back when the API key is configured.
      </p>
    </div>
  );
}
