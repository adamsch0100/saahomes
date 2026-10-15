/**
 * Platform console — every MLS connection: its health (last success, last
 * error, homes, next run), the brokerages on it and where each one is, who's
 * waiting for us to confirm an MLS approval, and the controls: approve or
 * suspend a brokerage, edit the display rules, turn the sync on or pause it,
 * manage credentials, test, and sync now.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  listMlsConnections, searchPlatformCatalog, createMlsConnection, patchMlsConnection, saveConnectionCredentials,
  testMlsConnection, syncMlsConnection, setBrokerageFeed,
} from '../../utils/mlsApi.js';
import { CredentialsForm, TestPreview } from './MlsConnect.jsx';

const inputClass = 'mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm';
const smallButton = 'min-h-[36px] px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-40';
const darkButton = 'min-h-[36px] px-3 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50';

const STATE_PILL = {
  live: ['Syncing', 'text-green-700 bg-green-50'],
  connected: ['Connected, not syncing', 'text-blue-700 bg-blue-50'],
  setup: ['Being set up', 'text-gray-600 bg-gray-100'],
  paused: ['Paused', 'text-red-700 bg-red-50'],
};
const STAGE_LABEL = {
  started: 'Not started', applied: 'Applied', approved: 'Approved', connected: 'Connected',
  going_live: 'Asked to go live', live: 'Live', paused: 'Suspended',
};

const when = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

function Health({ c }) {
  if (!c) return null;
  return (
    <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
      <div><dt className="text-gray-500">Homes</dt><dd className="font-semibold text-gray-900">{(c.listing_count || 0).toLocaleString()}</dd></div>
      <div><dt className="text-gray-500">Sales</dt><dd className="font-semibold text-gray-900">{(c.sold_count || 0).toLocaleString()}</dd></div>
      <div><dt className="text-gray-500">Last success</dt><dd className="text-gray-900">{when(c.last_success_at)}</dd></div>
      <div><dt className="text-gray-500">Next run</dt><dd className="text-gray-900">{c.builtin ? 'Hourly at :57' : c.running ? 'Running now' : when(c.next_run_at)}</dd></div>
      <div className="col-span-2 sm:col-span-1"><dt className="text-gray-500">Last error</dt><dd className={c.last_error ? 'text-red-700' : 'text-gray-400'}>{c.last_error ? `${c.last_error} (${when(c.last_error_at)})` : 'None'}</dd></div>
    </dl>
  );
}

function RulesForm({ feed, connection, platformInfo, busy, onSave }) {
  const [form, setForm] = useState({
    name: feed.name,
    disclaimer: feed.disclaimer,
    courtesy_required: !!feed.courtesy_required,
    sold_data_allowed: !!feed.sold_data_allowed,
    logo_required: !!feed.logo_required,
    display_verified: false,
    cadence_minutes: connection?.cadence_minutes || 30,
  });
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const body = { ...form };
        if (connection?.builtin) delete body.cadence_minutes;
        else body.cadence_minutes = Number(body.cadence_minutes);
        onSave(body);
      }}
    >
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Name buyers see</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">IDX notice ({'{brokerage}'} and {'{updated}'} are filled in)</span>
        <textarea rows={4} value={form.disclaimer} onChange={(e) => setForm({ ...form, disclaimer: e.target.value })} className={`${inputClass} py-2`} />
      </label>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {[
          ['courtesy_required', '“Listing courtesy of” required'],
          ['sold_data_allowed', 'Sold data allowed'],
          ['logo_required', 'MLS logo required'],
          ['display_verified', 'I checked these against the MLS’s rules'],
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 min-h-[36px] text-sm">
            <input type="checkbox" checked={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.checked })} className="h-4 w-4" />
            {label}
          </label>
        ))}
      </div>
      {!connection?.builtin && (
        <label className="block max-w-xs">
          <span className="text-xs font-medium text-gray-600">Sync every (minutes)</span>
          <input type="number" min={platformInfo?.min_cadence_minutes || 10} max={1440} value={form.cadence_minutes} onChange={(e) => setForm({ ...form, cadence_minutes: e.target.value })} className={inputClass} />
        </label>
      )}
      {feed.display_verified_at && <p className="text-xs text-green-700">Rules checked {when(feed.display_verified_at)}.</p>}
      <button type="submit" disabled={busy} className={darkButton}>{busy ? 'Saving…' : 'Save rules'}</button>
    </form>
  );
}

function ConnectionCard({ token, feed, platforms, onData, onTenantsChanged }) {
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [test, setTest] = useState(null);
  const c = feed.connection || {};
  const platformInfo = platforms.find((p) => p.id === c.platform);
  const [label, pillCls] = c.builtin ? ['Built in', 'text-green-700 bg-green-50'] : STATE_PILL[c.state] || [c.state, 'text-gray-600 bg-gray-100'];

  const run = async (key, fn, ok) => {
    setBusy(key);
    setNote(null);
    try {
      const res = await fn();
      if (res?.data) onData(res.data);
      if (ok) setNote({ kind: 'ok', text: ok });
      return res;
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Something went wrong' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const setTenant = async (b, status) => {
    if (status === 'approved' && !window.confirm(`Show live ${feed.name} listings on ${b.tenant_name}'s site? Only do this once the MLS has approved them.`)) return;
    const res = await run(`t${b.tenant_id}`, () => setBrokerageFeed(token, b.tenant_id, feed.key, { status }), status === 'approved' ? `${b.tenant_name} is live.` : `${b.tenant_name} is ${status}.`);
    if (res) {
      onTenantsChanged?.();
      const fresh = await listMlsConnections(token).catch(() => null);
      if (fresh?.data) onData(fresh.data);
    }
  };

  return (
    <li className="rounded-lg border border-gray-200 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{feed.name} <span className="text-xs font-normal text-gray-500 font-mono">{feed.key}</span></p>
          <p className="text-xs text-gray-500">{c.platform_name}{c.config?.originating_system ? ` · ${c.config.originating_system}` : ''}{c.config?.dataset_id ? ` · dataset ${c.config.dataset_id}` : ''}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pillCls}`}>{label}</span>
      </div>
      <Health c={c} />
      {c.dropped_fields?.length ? <p className="text-xs text-gray-500">Fields this MLS doesn’t share: {c.dropped_fields.join(', ')}</p> : null}

      <div>
        <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">Brokerages</p>
        {feed.brokerages.length ? (
          <ul className="mt-1 divide-y divide-gray-100">
            {feed.brokerages.map((b) => (
              <li key={b.tenant_id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{b.tenant_name}</span>{' '}
                  <span className={b.waiting_for_you ? 'text-amber-700 font-semibold' : 'text-gray-500'}>{STAGE_LABEL[b.stage] || b.stage}</span>
                  {b.office_mls_id ? <span className="text-gray-400"> · office {b.office_mls_id}</span> : null}
                </span>
                <span className="flex gap-2">
                  {b.status !== 'approved' && (
                    <button type="button" disabled={!!busy} onClick={() => setTenant(b, 'approved')} className={darkButton}>Approve</button>
                  )}
                  {b.status === 'approved' && b.tenant_id !== 1 && (
                    <button type="button" disabled={!!busy} onClick={() => setTenant(b, 'suspended')} className={smallButton}>Suspend</button>
                  )}
                  {b.status === 'suspended' && (
                    <button type="button" disabled={!!busy} onClick={() => setTenant(b, 'pending')} className={smallButton}>Back to pending</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-gray-500">None yet.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!c.builtin && (
          <>
            <button type="button" disabled={!!busy} onClick={() => run('sync', () => syncMlsConnection(token, feed.key), 'Sync started. Refresh in a minute to see the result.')} className={smallButton}>
              {busy === 'sync' ? 'Starting…' : 'Sync now'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                setBusy('test');
                setTest(null);
                try {
                  setTest(await testMlsConnection(token, feed.key));
                } catch (err) {
                  setTest({ ok: false, error: err.message });
                } finally {
                  setBusy(null);
                }
              }}
              className={smallButton}
            >
              {busy === 'test' ? 'Testing…' : 'Test'}
            </button>
            {c.state === 'live' ? (
              <button type="button" disabled={!!busy} onClick={() => run('state', () => patchMlsConnection(token, feed.key, { state: 'paused' }), 'Sync paused.')} className={smallButton}>Pause sync</button>
            ) : (
              <button type="button" disabled={!!busy} onClick={() => run('state', () => patchMlsConnection(token, feed.key, { state: 'live' }), 'Sync turned on.')} className={smallButton}>Turn sync on</button>
            )}
            <button type="button" onClick={() => setOpen(open === 'creds' ? null : 'creds')} className={smallButton} aria-expanded={open === 'creds'}>Credentials</button>
          </>
        )}
        <button type="button" onClick={() => setOpen(open === 'rules' ? null : 'rules')} className={smallButton} aria-expanded={open === 'rules'}>Display rules</button>
      </div>

      {open === 'rules' && (
        <RulesForm
          feed={feed}
          connection={c}
          platformInfo={platformInfo}
          busy={busy === 'rules'}
          onSave={(body) => run('rules', () => patchMlsConnection(token, feed.key, body), 'Rules saved.')}
        />
      )}
      {open === 'creds' && platformInfo && (
        <CredentialsForm
          platform={platformInfo}
          connection={c}
          busy={busy === 'creds'}
          submitLabel="Save credentials"
          onSave={(body) => run('creds', () => saveConnectionCredentials(token, feed.key, body), 'Saved.')}
        />
      )}
      <TestPreview result={test} />
      {note && <p className={`text-sm ${note.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>{note.text}</p>}
    </li>
  );
}

function AddMls({ token, onData }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!q.trim()) { setResults([]); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      searchPlatformCatalog(token, q).then((r) => !cancelled && setResults(r.data.results.slice(0, 8))).catch(() => {});
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [token, q]);
  return (
    <div>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Add an MLS from the catalog</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="MLS name or state" />
      </label>
      {results.length > 0 && (
        <ul className="mt-1 divide-y divide-gray-100 rounded-lg border border-gray-200">
          {results.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>{m.name} <span className="text-xs text-gray-500">{m.states.join(', ')} · {m.platforms.map((p) => p.platform_name).join(' / ')}</span></span>
              <button
                type="button"
                onClick={async () => {
                  setError(null);
                  try {
                    const r = await createMlsConnection(token, { catalog_id: m.id });
                    onData(r.data);
                    setQ('');
                  } catch (err) {
                    setError(err.message);
                  }
                }}
                className={smallButton}
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

export default function MlsConnectionsPanel({ token, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData((await listMlsConnections(token)).data);
    } catch (err) {
      setError(err.message || 'Could not load MLS connections');
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">MLS connections</h2>
          <p className="text-sm text-gray-500">Every MLS on the platform, how its sync is doing, and the brokerages on it.</p>
        </div>
        <button type="button" onClick={load} disabled={loading} className={smallButton}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>}
      {!data && !error && <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />}
      {data && (
        <>
          {data.waiting.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Waiting for you</p>
              <ul className="mt-1 list-disc pl-5">
                {data.waiting.map((w) => (
                  <li key={`${w.feed_key}-${w.tenant_id}`}>
                    {w.tenant_name} asked to go live on {w.feed_name}. Check the MLS approved them, then press Approve below.
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="space-y-3">
            {data.feeds.map((f) => (
              <ConnectionCard key={f.key} token={token} feed={f} platforms={data.platforms} onData={setData} onTenantsChanged={onChanged} />
            ))}
          </ul>
          <AddMls token={token} onData={setData} />
        </>
      )}
    </div>
  );
}
