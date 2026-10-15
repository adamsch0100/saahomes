/**
 * "Connect your MLS": the brokerage owner's guided setup, in Settings →
 * Listings and in the first-run MLS step.
 *
 *   1. Find your MLS (or "My MLS isn't listed": pick the platform)
 *   2. Apply: the steps for that MLS's data platform and a pre-filled vendor
 *      sheet to copy or download
 *   3. Approved: mark it when the MLS says yes
 *   4. Connect: paste what the MLS issued, then "Test connection" shows a few
 *      real listings with the attribution buyers will see
 *   5. Display rules and your office MLS ID
 *   6. Go live: sample homes switch to live listings
 *
 * Status: Not started → Applied → Approved → Connected → Live. Secrets are
 * sent once and never shown again (only "saved, ending in …").
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  searchMlsCatalog, getMlsConnect, startMlsConnect, patchMlsConnect, saveMlsCredentials,
  testMlsConnect, goLiveMls, cancelMlsConnect,
} from '../../utils/mlsApi.js';

const inputClass =
  'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';
const primaryClass =
  'min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50';
const secondaryClass =
  'min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50';

const STAGES = [
  { key: 'started', label: 'Not started' },
  { key: 'applied', label: 'Applied' },
  { key: 'approved', label: 'Approved' },
  { key: 'connected', label: 'Connected' },
  { key: 'live', label: 'Live' },
];
const stageIndex = (stage) => {
  if (stage === 'going_live') return 3;
  if (stage === 'paused') return 4;
  return Math.max(0, STAGES.findIndex((s) => s.key === stage));
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const money = (n) => (n == null ? '' : `$${Math.round(Number(n)).toLocaleString('en-US')}`);

function Note({ kind = 'info', children }) {
  if (!children) return null;
  const cls = kind === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : kind === 'ok'
      ? 'border-green-200 bg-green-50 text-green-800'
      : kind === 'warn'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-gray-200 bg-gray-50 text-gray-700';
  return <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

/** Progress across the five stages; scrolls sideways on a phone. */
function StageBar({ stage }) {
  const at = stageIndex(stage);
  return (
    <ol className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-1" aria-label="Progress">
      {STAGES.map((s, i) => {
        const done = i < at || (i === at && stage === 'live');
        const current = i === at && stage !== 'live';
        return (
          <li key={s.key} className="flex-1 min-w-[72px]">
            <div className={`h-1.5 rounded-full ${done ? 'bg-green-600' : current ? 'bg-gray-900' : 'bg-gray-200'}`} />
            <p className={`mt-1 text-xs ${current ? 'font-semibold text-gray-900' : done ? 'text-green-700' : 'text-gray-400'}`}
              aria-current={current ? 'step' : undefined}
            >
              {i === 3 && stage === 'going_live' ? 'Going live…' : s.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Step({ n, title, done, open, onToggle, children }) {
  return (
    <section className="rounded-lg border border-gray-200">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full min-h-[48px] flex items-center gap-3 px-4 text-left"
      >
        <span
          aria-hidden="true"
          className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
        >
          {done ? '✓' : n}
        </span>
        <span className="flex-1 font-semibold text-gray-900">{title}</span>
        <span className="text-gray-400 text-sm" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="px-4 pb-4 space-y-3 text-sm text-gray-700">{children}</div>}
    </section>
  );
}

/** Find an MLS in the catalog, or describe one that isn't listed. */
function FindMls({ token, platforms, onPick, busy }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [custom, setCustom] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchMlsCatalog(token, q)
        .then((res) => !cancelled && setResults(res.data.results || []))
        .catch(() => !cancelled && setResults([]))
        .finally(() => !cancelled && setSearching(false));
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [token, q]);

  if (custom) {
    return (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onPick({ custom });
        }}
      >
        <p className="font-semibold text-gray-900">Tell us about your MLS</p>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">MLS name</span>
          <input value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} className={inputClass} placeholder="Pine Valley MLS" required />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">States it covers</span>
          <input value={custom.states} onChange={(e) => setCustom({ ...custom, states: e.target.value })} className={inputClass} placeholder="CO, WY" />
        </label>
        <fieldset>
          <legend className="text-sm font-medium text-gray-700">How does your MLS share listing data?</legend>
          <p className="text-xs text-gray-500">Not sure? Ask your MLS “Which platform do you use for IDX data feeds?” Most use one of these.</p>
          <div className="mt-2 space-y-2">
            {platforms.map((p) => (
              <label key={p.id} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${custom.platform === p.id ? 'border-black' : 'border-gray-200 hover:border-gray-400'}`}>
                <input type="radio" name="platform" value={p.id} checked={custom.platform === p.id} onChange={() => setCustom({ ...custom, platform: p.id })} className="mt-1" />
                <span>
                  <span className="block font-medium text-gray-900">{p.name}</span>
                  <span className="block text-xs text-gray-500">{p.summary}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={busy || !custom.name.trim() || !custom.platform} className={primaryClass}>{busy ? 'Saving…' : 'Continue'}</button>
          <button type="button" onClick={() => setCustom(null)} className={secondaryClass}>Back to the list</button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="font-semibold text-gray-900">Find your MLS</span>
        <span className="block text-gray-500 text-sm">Search by name, nickname or state (like “TX”).</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="Start typing your MLS’s name" aria-controls="mls-results" />
      </label>
      <ul id="mls-results" className="max-h-80 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200" aria-busy={searching}>
        {results.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick({ catalog_id: m.id, platform: m.platforms[0]?.platform })}
              className="w-full min-h-[52px] px-3 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="block font-medium text-gray-900">{m.name}</span>
              <span className="block text-xs text-gray-500">
                {m.states.join(', ')} · {m.platforms.map((p) => p.platform_name).join(' or ')}
              </span>
            </button>
          </li>
        ))}
        {!results.length && !searching && <li className="px-3 py-3 text-sm text-gray-500">No match in our list.</li>}
      </ul>
      <button type="button" onClick={() => setCustom({ name: q, states: '', platform: '' })} className={secondaryClass}>
        My MLS isn’t listed
      </button>
    </div>
  );
}

/** Settings and credentials for a platform. Saved secrets show only as hints. */
export function CredentialsForm({ platform, connection, busy, onSave, submitLabel = 'Save' }) {
  const [config, setConfig] = useState(() => ({ ...(connection?.config || {}) }));
  const [creds, setCreds] = useState({});
  useEffect(() => { setConfig({ ...(connection?.config || {}) }); }, [connection?.config]);
  const hints = connection?.credentials_hint || {};
  const fields = [
    ...(platform.config_fields || []).map((f) => ({ ...f, kind: 'config' })),
    ...(platform.credential_fields || []).map((f) => ({ ...f, kind: 'cred' })),
  ];
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ config, credentials: creds });
        setCreds({});
      }}
    >
      {fields.map((f) => {
        const hint = f.kind === 'cred' ? hints[f.key] : null;
        const value = f.kind === 'config' ? config[f.key] || '' : creds[f.key] || '';
        return (
          <label key={`${f.kind}-${f.key}`} className="block">
            <span className="text-sm font-medium text-gray-700">
              {f.label}{f.optional || (f.kind === 'config' && !f.required) ? <span className="text-gray-400 font-normal"> (optional)</span> : null}
            </span>
            {f.help ? <span className="block text-xs text-gray-500">{f.help}</span> : null}
            <input
              type={f.secret ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => (f.kind === 'config'
                ? setConfig({ ...config, [f.key]: e.target.value })
                : setCreds({ ...creds, [f.key]: e.target.value }))}
              placeholder={hint?.saved ? `Saved${hint.ending ? `, ending in ${hint.ending}` : ''}. Leave empty to keep it.` : ''}
              className={`${inputClass} font-mono`}
            />
          </label>
        );
      })}
      <button type="submit" disabled={busy} className={primaryClass}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  );
}

/** "Test connection" results: listings as buyers will see them. */
export function TestPreview({ result }) {
  if (!result) return null;
  if (!result.ok) return <Note kind="error">{result.error}</Note>;
  return (
    <div className="space-y-3">
      <Note kind="ok">It works. Here are {result.listings.length} of your MLS’s listings, the way buyers will see them.</Note>
      {result.warnings?.map((w) => <Note key={w} kind="warn">{w}</Note>)}
      <ul className="grid gap-3 sm:grid-cols-2">
        {result.listings.map((l) => (
          <li key={l.mls_number} className="rounded-lg border border-gray-200 overflow-hidden">
            {l.photo ? (
              <img src={l.photo} alt="" loading="lazy" className="h-32 w-full object-cover bg-gray-100" />
            ) : (
              <div className="h-32 bg-gray-100 flex items-center justify-center text-xs text-gray-400">No photo</div>
            )}
            <div className="p-3">
              <p className="font-semibold text-gray-900">{money(l.price)}</p>
              <p className="text-gray-700">{[l.address, l.city].filter(Boolean).join(', ') || 'Address withheld'}</p>
              <p className="text-xs text-gray-500">
                {[l.beds != null && `${l.beds} bd`, l.baths != null && `${l.baths} ba`, l.sqft && `${Number(l.sqft).toLocaleString()} sq ft`, `MLS# ${l.mls_number}`].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-1 text-xs text-gray-600">{l.courtesy || 'Listing office not in the data yet'}</p>
            </div>
          </li>
        ))}
      </ul>
      {result.disclaimer && (
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notice under every listing</p>
          <p className="mt-1 text-xs text-gray-600">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function VendorSheet({ sheet, mlsName }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sheet.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  const download = () => {
    const blob = new Blob([sheet.text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vendor-information-${String(mlsName || 'mls').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  return (
    <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
      <p className="font-semibold text-gray-900">Vendor information sheet</p>
      <p className="text-xs text-gray-500">The MLS will ask who builds your website and how the data is used. These answers are filled in from your settings; anything blank, add in Settings first.</p>
      <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,14rem)_1fr] text-sm">
        {sheet.rows.map((r) => (
          <React.Fragment key={r.label}>
            <dt className="text-gray-500">{r.label}</dt>
            <dd className={`break-words ${r.value ? 'text-gray-900' : 'text-amber-700'}`}>{r.value || 'Not filled in yet'}</dd>
          </React.Fragment>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={secondaryClass}>{copied ? 'Copied' : 'Copy'}</button>
        <button type="button" onClick={download} className={secondaryClass}>Download</button>
      </div>
    </div>
  );
}

function FeedWizard({ token, feed, onData }) {
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [test, setTest] = useState(null);
  const [office, setOffice] = useState(feed.office_mls_id || '');
  const [checked, setChecked] = useState(false);
  const [attest, setAttest] = useState(false);
  const conn = feed.connection || {};
  const sharedLive = conn.builtin || (conn.state === 'live' && !conn.mine);
  const stage = feed.stage;
  const at = stageIndex(stage);

  // Open the first step that still needs doing.
  useEffect(() => {
    if (open !== null) return;
    if (stage === 'started') setOpen('apply');
    else if (stage === 'applied') setOpen('approved');
    else if (stage === 'approved') setOpen('connect');
    else if (stage === 'connected') setOpen(feed.display_confirmed_at ? 'golive' : 'display');
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setOffice(feed.office_mls_id || ''); }, [feed.office_mls_id]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    setNote(null);
    try {
      const res = await fn();
      if (res?.data) onData(res.data);
      if (ok) setNote({ kind: 'ok', text: typeof ok === 'function' ? ok(res) : ok });
      return res;
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Something went wrong. Please try again.' });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const toggle = (k) => setOpen(open === k ? '' : k);
  const runTest = async () => {
    setBusy('test');
    setNote(null);
    setTest(null);
    try {
      const res = await testMlsConnect(token, feed.key);
      setTest(res);
      if (res.data) onData(res.data);
    } catch (err) {
      setTest({ ok: false, error: err.message || 'The test didn’t work.' });
      getMlsConnectSafe(token).then((d) => d && onData(d));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-gray-900">{feed.name}</p>
          <p className="text-xs text-gray-500">Data comes through {feed.platform.name}</p>
        </div>
        {stage === 'live' && <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-green-50 text-green-700">Live</span>}
        {stage === 'paused' && <span className="text-xs font-bold uppercase tracking-wide px-2 py-1 rounded bg-red-50 text-red-700">Paused</span>}
      </div>
      <StageBar stage={stage} />

      {stage === 'live' ? (
        <Note kind="ok">
          Live listings from {feed.name} are on your site
          {conn.listing_count ? ` (${conn.listing_count.toLocaleString()} homes)` : ''}
          {conn.last_success_at ? `, last updated ${fmtDate(conn.last_success_at)}` : ''}.
        </Note>
      ) : stage === 'paused' ? (
        <Note kind="error">{feed.name} is paused for your site. Contact us and we’ll sort it out.</Note>
      ) : stage === 'going_live' ? (
        <Note kind="info">
          {feed.self_serve_go_live
            ? `Importing your listings now. Your site switches from sample homes as soon as the first import finishes, usually within the hour.${conn.last_error ? ` Last try: ${conn.last_error}` : ''}`
            : `We’re confirming your approval with ${feed.name} and will switch you on, usually within one business day. You don’t need to do anything else.`}
        </Note>
      ) : null}

      {!['live', 'paused'].includes(stage) && (
        <div className="space-y-2">
          <Step n={1} title={`Apply to ${feed.name}`} done={at >= 1} open={open === 'apply'} onToggle={() => toggle('apply')}>
            <p>{feed.platform.summary}</p>
            <ol className="space-y-2 list-decimal pl-5">
              {feed.checklist.map((s) => (
                <li key={s.title}>
                  <span className="font-medium text-gray-900">{s.title}.</span> {s.body}
                </li>
              ))}
            </ol>
            {feed.platform.vendor_contact?.url && (
              <p>
                <a href={feed.platform.vendor_contact.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">
                  Open {feed.platform.name}
                </a>
                {feed.platform.vendor_contact.email ? <span className="text-gray-500"> · help: {feed.platform.vendor_contact.email}</span> : null}
              </p>
            )}
            <VendorSheet sheet={feed.vendor_sheet} mlsName={feed.name} />
            {at < 1 && (
              <button type="button" disabled={!!busy} onClick={() => run('applied', () => patchMlsConnect(token, feed.key, { stage: 'applied' }), 'Saved. Next, wait for the MLS to approve you.').then(() => setOpen('approved'))} className={primaryClass}>
                {busy === 'applied' ? 'Saving…' : 'I’ve applied'}
              </button>
            )}
          </Step>

          <Step n={2} title="The MLS approves you" done={at >= 2} open={open === 'approved'} onToggle={() => toggle('approved')}>
            <p>Most MLSs take a few days to two weeks. They’ll email you (or us) when you’re approved. Until then your site keeps showing sample homes, clearly marked, so you can share it and try everything.</p>
            {at < 2 && (
              <button type="button" disabled={!!busy} onClick={() => run('approved', () => patchMlsConnect(token, feed.key, { stage: 'approved' }), 'Great. Next, connect the data.').then(() => setOpen('connect'))} className={primaryClass}>
                {busy === 'approved' ? 'Saving…' : 'The MLS approved us'}
              </button>
            )}
          </Step>

          <Step n={3} title="Connect the data" done={at >= 3} open={open === 'connect'} onToggle={() => toggle('connect')}>
            {sharedLive ? (
              <Note kind="ok">{feed.name} is already connected on our platform, so there’s nothing to enter here.</Note>
            ) : conn.entered_by_other ? (
              <Note kind="info">Another brokerage is connecting {feed.name} on our platform. Once it’s live we confirm your approval and switch you on; nothing to enter here.</Note>
            ) : (
              <>
                <p>
                  Paste what {feed.name} or {feed.platform.name} sent you once you were approved. We keep it encrypted and never show it again.
                  {feed.platform.rate_note ? <span className="text-gray-500"> We stay within their limits ({feed.platform.rate_note}).</span> : null}
                </p>
                <CredentialsForm
                  platform={feed.platform}
                  connection={conn}
                  busy={busy === 'creds'}
                  submitLabel="Save connection details"
                  onSave={(body) => run('creds', () => saveMlsCredentials(token, feed.key, body), 'Saved. Now test the connection.')}
                />
              </>
            )}
            {(conn.has_credentials || sharedLive) && !conn.builtin && (
              <div className="pt-1">
                <button type="button" disabled={!!busy} onClick={runTest} className={secondaryClass}>
                  {busy === 'test' ? 'Testing… (a few seconds)' : 'Test connection'}
                </button>
                {conn.last_test_at && !test && (
                  <p className="mt-1 text-xs text-gray-500">
                    Last test {fmtDate(conn.last_test_at)}: {conn.last_test_ok ? 'worked' : conn.last_test_error || 'didn’t work'}
                  </p>
                )}
              </div>
            )}
            <TestPreview result={test} />
          </Step>

          <Step n={4} title="Check the display rules" done={!!feed.display_confirmed_at} open={open === 'display'} onToggle={() => toggle('display')}>
            <p>IDX rules are the MLS’s rules for showing other brokerages’ listings on your site. Here’s how your site will show {feed.name} listings. Check them against your MLS’s IDX rules (they’re in your license or on the MLS’s website), and tell us if anything differs.</p>
            <ul className="space-y-1">
              <li>{feed.display.courtesy_required ? '✓ Every home says “Listing courtesy of” and the listing office.' : 'Listing office not shown.'}</li>
              <li>{feed.display.sold_data_allowed ? '✓ Recent sales can be shown.' : 'Recent sales are off (we turn them on once the MLS’s rules allow it).'}</li>
              <li>{feed.display.logo_required ? '✓ The MLS’s logo shows with its listings.' : 'No MLS logo required.'}</li>
            </ul>
            {feed.display.disclaimer_preview && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Notice under every listing</p>
                <p className="mt-1 text-xs text-gray-600">{feed.display.disclaimer_preview}</p>
              </div>
            )}
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Your office MLS ID</span>
              <span className="block text-xs text-gray-500">The ID your MLS gave your office (not an agent’s ID). It’s on your MLS account page or your license paperwork.</span>
              <input value={office} onChange={(e) => setOffice(e.target.value)} className={`${inputClass} font-mono max-w-xs`} placeholder="e.g. 1234" />
            </label>
            {feed.display.sold_data_allowed && (
              <label className="flex items-center gap-2 min-h-[44px]">
                <input type="checkbox" checked={feed.sold_enabled} onChange={(e) => run('sold', () => patchMlsConnect(token, feed.key, { sold_enabled: e.target.checked }))} className="h-4 w-4" />
                <span>Show recent sales on my site</span>
              </label>
            )}
            {feed.display_confirmed_at ? (
              <p className="text-green-700 font-medium">Confirmed {fmtDate(feed.display_confirmed_at)}.</p>
            ) : (
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>These match my MLS’s IDX rules.</span>
              </label>
            )}
            <button
              type="button"
              disabled={!!busy || (!feed.display_confirmed_at && !checked)}
              onClick={() => run('display', () => patchMlsConnect(token, feed.key, { office_mls_id: office, ...(feed.display_confirmed_at ? {} : { confirm_display: true }) }), 'Saved.').then((r) => r && setOpen('golive'))}
              className={primaryClass}
            >
              {busy === 'display' ? 'Saving…' : feed.display_confirmed_at ? 'Save office MLS ID' : 'Confirm'}
            </button>
          </Step>

          <Step n={5} title="Go live" done={stage === 'going_live'} open={open === 'golive'} onToggle={() => toggle('golive')}>
            {stage === 'going_live' ? (
              <p>Requested {fmtDate(feed.stage_log?.go_live_requested)}. We’ll take it from here.</p>
            ) : (
              <>
                <p>
                  {feed.self_serve_go_live
                    ? 'Your site switches from sample homes to live listings as soon as the first import finishes.'
                    : `We’ll confirm your approval with ${feed.name}, then switch your site to live listings.`}
                </p>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1 h-4 w-4" />
                  <span>{feed.name} approved this site to show its listings (IDX), and my managing broker signed the license.</span>
                </label>
                <button
                  type="button"
                  disabled={!!busy || !attest || !feed.display_confirmed_at || (feed.self_serve_go_live && conn.last_test_ok !== true)}
                  onClick={() => run('golive', () => goLiveMls(token, feed.key), (res) => (res.live ? 'You’re live.' : res.waiting_for === 'platform' ? 'Sent. We’ll confirm and switch you on.' : 'Importing your listings now.'))}
                  className={primaryClass}
                >
                  {busy === 'golive' ? 'Starting…' : 'Go live'}
                </button>
                {!feed.display_confirmed_at && <p className="text-xs text-gray-500">Confirm the display rules first.</p>}
                {feed.self_serve_go_live && conn.last_test_ok !== true && <p className="text-xs text-gray-500">Test the connection first.</p>}
              </>
            )}
          </Step>
        </div>
      )}

      <Note kind={note?.kind}>{note?.text}</Note>

      {!['live', 'paused'].includes(stage) && (
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            if (window.confirm(`Stop setting up ${feed.name}? Your progress here is cleared.`)) run('cancel', () => cancelMlsConnect(token, feed.key));
          }}
          className="text-sm text-gray-500 underline min-h-[36px]"
        >
          Stop setting up {feed.name}
        </button>
      )}
    </div>
  );
}

async function getMlsConnectSafe(token) {
  try {
    return (await getMlsConnect(token)).data;
  } catch {
    return null;
  }
}

/** The whole "Connect your MLS" card: your MLSs, and adding one. */
export default function MlsConnect({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData((await getMlsConnect(token)).data);
    } catch (err) {
      setError(err.message || 'Could not load your MLS setup');
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const pick = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const res = await startMlsConnect(token, body);
      setData(res.data);
      setAdding(false);
    } catch (err) {
      setError(err.message || 'Could not start that MLS');
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return error ? <Note kind="error">{error}</Note> : <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />;
  }
  if (data.home) return null;
  const showFind = adding || !data.feeds.length;

  return (
    <div className="space-y-4">
      <div>
        <p className="font-semibold text-gray-900">Connect your MLS</p>
        <p className="text-sm text-gray-500">
          IDX is the MLS program that lets your site show every brokerage’s listings. We’ll walk you through getting approved and connected; most of it is paperwork your MLS already knows.
        </p>
      </div>
      {data.feeds.map((f) => <FeedWizard key={f.key} token={token} feed={f} onData={setData} />)}
      {showFind ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <FindMls token={token} platforms={data.platforms} onPick={pick} busy={busy} />
          {adding && <button type="button" onClick={() => setAdding(false)} className="mt-2 text-sm text-gray-500 underline min-h-[36px]">Cancel</button>}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={secondaryClass}>Add another MLS</button>
      )}
      <Note kind="error">{error}</Note>
    </div>
  );
}
