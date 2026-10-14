/**
 * Owner reporting: per agent over the last 7, 30 or 90 days. Leads assigned,
 * time to first contact, active searchers, hot leads, tours, texts and email
 * sent, reply rate; where leads came from. CSV export.
 * GET /api/admin/reports/agents?days=
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm, downloadReportCsv } from '../../utils/crmApi.js';

const WINDOWS = [7, 30, 90];

const METRICS = [
  { key: 'leads_assigned', label: 'Leads assigned' },
  { key: 'first_contact_mins', label: 'First contact', format: 'mins', lowerIsBetter: true },
  { key: 'active_searchers', label: 'Active searchers' },
  { key: 'hot_leads', label: 'Hot leads' },
  { key: 'tours', label: 'Tours' },
  { key: 'texts_sent', label: 'Texts sent' },
  { key: 'emails_sent', label: 'Emails sent' },
  { key: 'response_rate', label: 'Reply rate', format: 'pct' },
];

function fmt(v, format) {
  if (v == null) return '—';
  if (format === 'pct') return `${Math.round(v * 100)}%`;
  if (format === 'mins') {
    if (v < 60) return `${v} min`;
    if (v < 60 * 48) return `${Math.round(v / 60)} hr`;
    return `${Math.round(v / 1440)} days`;
  }
  return String(v);
}

/** A bar scaled to the best agent on this metric (shortest time wins for first contact). */
function Bar({ value, max, min, lowerIsBetter, format }) {
  let pct = 0;
  if (value != null) {
    if (format === 'pct') pct = value * 100;
    else if (lowerIsBetter) pct = value > 0 ? Math.max(8, (min / value) * 100) : 100;
    else pct = max > 0 ? (value / max) * 100 : 0;
  }
  return (
    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
      <div className="h-full rounded-full bg-[color:var(--brand-accent)]" style={{ width: `${Math.min(100, Math.round(pct))}%` }} />
    </div>
  );
}

export default function BrokerageReports({ token }) {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await crm.report(token, days));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, days]);
  useEffect(() => { load(); }, [load]);

  const csv = async () => {
    setCsvBusy(true);
    try {
      await downloadReportCsv(token, days);
    } catch (e) {
      setError(e.message);
    } finally {
      setCsvBusy(false);
    }
  };

  const agents = report?.agents || [];
  const stat = (key) => {
    const vals = agents.map((a) => a[key]).filter((v) => v != null);
    return { max: vals.length ? Math.max(...vals) : 0, min: vals.length ? Math.min(...vals.filter((v) => v > 0).concat([Infinity])) : 0 };
  };
  const stats = Object.fromEntries(METRICS.map((m) => [m.key, stat(m.key)]));
  const totalSources = (report?.sources || []).reduce((n, s) => n + s.total, 0);
  const nameOf = (id) => (id === 'unassigned' ? 'Unassigned' : agents.find((a) => String(a.id) === String(id))?.name || 'Former agent');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">How your agents are doing</h2>
            <p className="text-sm text-gray-500 mt-1">Leads, speed to first contact, tours and replies, per agent.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden" role="group" aria-label="Time window">
              {WINDOWS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={days === d}
                  onClick={() => setDays(d)}
                  className={`min-h-[44px] px-4 text-sm font-semibold ${days === d ? 'bg-black text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {d} days
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={csv}
              disabled={csvBusy || !report}
              className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-semibold text-gray-800 hover:border-black disabled:opacity-50"
            >
              {csvBusy ? 'Preparing…' : 'Download CSV'}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        {report && (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-gray-50 px-2 py-3">
              <p className="text-2xl font-bold text-gray-900">{agents.reduce((n, a) => n + a.leads_assigned, 0) + report.unassigned.new_leads}</p>
              <p className="text-xs text-gray-500">New leads</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-2 py-3">
              <p className="text-2xl font-bold text-gray-900">{agents.reduce((n, a) => n + a.tours, 0) + report.unassigned.tours}</p>
              <p className="text-xs text-gray-500">Tours</p>
            </div>
            <div className="rounded-lg bg-gray-50 px-2 py-3">
              <p className={`text-2xl font-bold ${report.unassigned.new_leads ? 'text-amber-700' : 'text-gray-900'}`}>{report.unassigned.new_leads}</p>
              <p className="text-xs text-gray-500">Still unassigned</p>
            </div>
          </div>
        )}
      </div>

      {loading && !report && <p className="text-sm text-gray-500">Loading…</p>}

      {report && agents.length === 0 && (
        <p className="bg-white rounded-xl border border-gray-200 p-5 text-sm text-gray-600">No agents yet. Invite your team on the Agents tab.</p>
      )}

      {report && agents.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((a) => (
            <section key={a.id} className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${loading ? 'opacity-60' : ''}`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-bold text-gray-900 truncate">{a.name}</h3>
                <span className="text-xs text-gray-500 shrink-0">{a.role === 'admin' ? 'Owner' : a.active ? 'Agent' : 'Inactive'}</span>
              </div>
              <dl className="mt-3 space-y-2.5">
                {METRICS.map((m) => (
                  <div key={m.key}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <dt className="text-gray-600">{m.label}</dt>
                      <dd className="font-semibold text-gray-900 tabular-nums">
                        {fmt(a[m.key], m.format)}
                        {m.key === 'first_contact_mins' && a.new_leads > 0 && (
                          <span className="ml-1 text-xs font-normal text-gray-500">({a.contacted}/{a.new_leads} reached)</span>
                        )}
                        {m.key === 'response_rate' && a.texted_leads > 0 && (
                          <span className="ml-1 text-xs font-normal text-gray-500">({a.replied}/{a.texted_leads})</span>
                        )}
                      </dd>
                    </div>
                    <Bar value={a[m.key]} max={stats[m.key].max} min={stats[m.key].min} lowerIsBetter={m.lowerIsBetter} format={m.format} />
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      {report && report.sources.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900">Where leads came from</h3>
          <ul className="mt-3 space-y-3">
            {report.sources.map((s) => (
              <li key={s.source}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="inline-block font-medium text-gray-800 first-letter:uppercase">{s.label}</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{s.total}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-[color:var(--brand-accent)]" style={{ width: `${totalSources ? Math.round((s.total / totalSources) * 100) : 0}%` }} />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {Object.entries(s.by_agent).map(([id, n]) => `${nameOf(id)} ${n}`).join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
