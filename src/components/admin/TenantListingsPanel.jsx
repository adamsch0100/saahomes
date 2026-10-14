/**
 * Platform console — one brokerage's listings (MLS): for each feed its status
 * (pending / approved / suspended), office MLS ID, sold data on or off and
 * notes; the brokerage's service areas; and the log of every change.
 * A brokerage with no approved feed shows sample homes.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getTenantFeeds, putTenantFeed, putTenantServiceAreas } from '../../utils/api.js';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved (live)' },
  { value: 'suspended', label: 'Suspended' },
];

const inputClass = 'mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm';

function describeChange(changes) {
  return Object.entries(changes || {})
    .map(([k, v]) => {
      const fmt = (x) => (Array.isArray(x) ? x.join(', ') || 'none' : x === null || x === '' ? 'none' : String(x));
      const label = { status: 'status', office_mls_id: 'office MLS ID', sold_enabled: 'sold data', notes: 'notes', service_areas: 'service areas' }[k] || k;
      return `${label}: ${fmt(v?.from)} → ${fmt(v?.to)}`;
    })
    .join('; ');
}

function FeedRow({ feed, busy, onSave, home }) {
  const [form, setForm] = useState({
    status: feed.status === 'none' ? 'pending' : feed.status,
    office_mls_id: feed.office_mls_id || '',
    sold_enabled: !!feed.sold_enabled,
    notes: feed.notes || '',
  });
  useEffect(() => {
    setForm({
      status: feed.status === 'none' ? 'pending' : feed.status,
      office_mls_id: feed.office_mls_id || '',
      sold_enabled: !!feed.sold_enabled,
      notes: feed.notes || '',
    });
  }, [feed]);

  return (
    <form
      className="rounded-lg border border-gray-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(feed.key, form);
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-gray-900">
          {feed.name} <span className="text-xs font-normal text-gray-500">{feed.vendor}</span>
        </p>
        <p className="text-xs text-gray-500">
          {feed.status === 'none' ? 'Not set up' : `Now: ${feed.status}`}
          {feed.approved_at ? ` · approved ${new Date(feed.approved_at).toLocaleDateString()}` : ''}
        </p>
      </div>
      <div className="mt-3 grid sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Status</span>
          <select
            value={form.status}
            disabled={home}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className={`${inputClass} bg-white`}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Office MLS ID</span>
          <input
            value={form.office_mls_id}
            onChange={(e) => setForm({ ...form, office_mls_id: e.target.value })}
            className={`${inputClass} font-mono`}
            placeholder="e.g. 1234"
          />
        </label>
        <label className="flex items-center gap-2 sm:mt-6 min-h-[40px]">
          <input
            type="checkbox"
            checked={form.sold_enabled}
            onChange={(e) => setForm({ ...form, sold_enabled: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--brand-accent)]"
          />
          <span className="text-sm text-gray-700">Show sold data</span>
        </label>
        <label className="block sm:col-span-3">
          <span className="text-xs font-medium text-gray-600">Notes</span>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className={inputClass}
            placeholder="License signed 10/2, vendor ID …"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-3 min-h-[40px] px-4 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50"
      >
        {busy ? 'Saving…' : `Save ${feed.name}`}
      </button>
    </form>
  );
}

export default function TenantListingsPanel({ token, tenant, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [areas, setAreas] = useState('');

  const adopt = (d) => {
    setData(d);
    setAreas((d?.service_areas || []).join(', '));
  };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getTenantFeeds(token, tenant.id);
      adopt(res.data);
    } catch (err) {
      setError(err.message || 'Could not load listings settings');
    }
  }, [token, tenant.id]);

  useEffect(() => {
    load();
  }, [load]);

  const saveFeed = async (key, form) => {
    if (form.status === 'approved' && !window.confirm(`Show live ${key.toUpperCase()} listings on ${tenant.name}'s site? Only do this once the MLS has approved them.`)) {
      return;
    }
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const res = await putTenantFeed(token, tenant.id, key, form);
      adopt(res.data);
      setNotice('Saved and logged.');
      onChanged?.();
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  const saveAreas = async (e) => {
    e.preventDefault();
    setBusy('areas');
    setError(null);
    setNotice(null);
    try {
      const res = await putTenantServiceAreas(token, tenant.id, areas.split(',').map((a) => a.trim()).filter(Boolean));
      adopt(res.data);
      setNotice('Service areas saved.');
    } catch (err) {
      setError(err.message || 'Could not save');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Listings (MLS) · {tenant.name}</h2>
        {data ? (
          <p className={`mt-1 text-sm font-semibold ${data.mode === 'live' ? 'text-green-700' : 'text-amber-700'}`}>
            {data.mode === 'live' ? data.headline : 'Sample homes (no approved feed)'}
          </p>
        ) : null}
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
      {notice && <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm">{notice}</div>}
      {!data && !error && <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />}
      {data && (
        <>
          {data.feeds.map((f) => (
            <FeedRow key={f.key} feed={f} busy={busy === f.key} onSave={saveFeed} home={tenant.id === 1 && f.key === 'ires'} />
          ))}
          <form onSubmit={saveAreas}>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Service areas (towns or counties, comma-separated)</span>
              <input value={areas} onChange={(e) => setAreas(e.target.value)} className={inputClass} placeholder="Fort Collins, Weld County" />
            </label>
            <button
              type="submit"
              disabled={busy === 'areas'}
              className="mt-2 min-h-[40px] px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-50"
            >
              {busy === 'areas' ? 'Saving…' : 'Save service areas'}
            </button>
          </form>
          <div>
            <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Change log</p>
            {data.log?.length ? (
              <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
                {data.log.map((row, i) => (
                  <li key={i} className="break-words">
                    <span className="text-gray-400">{new Date(row.created_at).toLocaleString()}</span>{' '}
                    {row.feed_key ? <span className="font-semibold uppercase">{row.feed_key}</span> : null}{' '}
                    {describeChange(row.changes)}
                    {row.changed_by ? <span className="text-gray-400"> · {row.changed_by}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No changes yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
