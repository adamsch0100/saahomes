/**
 * Owner settings cards for running without Follow Up Boss:
 *   "Your CRM"      Follow Up Boss or this cockpit, in plain words; every
 *                   contact out as CSV, and contacts in from a CSV (a
 *                   Follow Up Boss export or any spreadsheet).
 *   "Lead sources"  links for Zillow, Realtor.com, Homes.com, lead emails,
 *                   Zapier / web forms and Facebook lead ads; who gets new
 *                   leads; replies to the team inbox; recent leads.
 * Rendered inside BrokerageSettings, which passes its Section card.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm, downloadContactsCsv, previewContactsCsv, importContactsCsv } from '../../utils/crmApi.js';

const inputClass = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
const primaryClass = 'min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] bg-[color:var(--brand-accent)] disabled:opacity-50';
const secondaryClass = 'min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50 bg-white';

function Msg({ msg }) {
  if (!msg) return null;
  const cls = msg.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800';
  return <div className={`mt-3 border px-3 py-2 rounded-lg text-sm ${cls}`} role={msg.kind === 'error' ? 'alert' : 'status'}>{msg.text}</div>;
}

function Copyable({ label, value, hint }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* still selectable */ }
  };
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <button type="button" onClick={copy} className="ml-auto shrink-0 min-h-[32px] px-2.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-black">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
      <p className="mt-1 font-mono text-[11px] text-gray-700 break-all bg-gray-50 rounded px-2 py-1">{value}</p>
    </div>
  );
}

// ------------------------------------------------------------ Your CRM

function ModeCard({ active, title, children, onPick, busy }) {
  return (
    <button type="button" onClick={onPick} disabled={busy || active} aria-pressed={active}
      className={`text-left rounded-xl border-2 p-4 min-h-[120px] transition-colors ${active ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:border-gray-400'}`}>
      <span className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-full border-2 ${active ? 'border-gray-900 bg-gray-900' : 'border-gray-400'}`} aria-hidden="true" />
        <span className="font-bold text-gray-900">{title}</span>
        {active && <span className="ml-auto text-[10px] font-bold uppercase tracking-wide bg-gray-900 text-white rounded px-1.5 py-0.5">In use</span>}
      </span>
      <span className="block mt-2 text-sm text-gray-600">{children}</span>
    </button>
  );
}

function ImportContacts({ token, onDone }) {
  const [text, setText] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [mapping, setMapping] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    setMsg(null);
    setPreview(null);
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setMsg({ kind: 'error', text: 'That file is over 15 MB. Split it into smaller files.' }); return; }
    const t = await f.text();
    setText(t);
    setFileName(f.name);
    setBusy(true);
    try {
      const p = await previewContactsCsv(token, t);
      setPreview(p);
      setMapping(p.mapping || {});
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await importContactsCsv(token, text, mapping);
      const parts = [`${r.created} added`, `${r.updated} updated`];
      if (r.notes) parts.push(`${r.notes} notes`);
      if (r.skipped) parts.push(`${r.skipped} skipped`);
      const why = r.errors?.length ? ` First skipped: row ${r.errors[0].row}, ${r.errors[0].reason.toLowerCase()}.` : '';
      setMsg({ kind: 'ok', text: `Done: ${parts.join(', ')}.${why}` });
      setPreview(null);
      setText(null);
      setFileName('');
      onDone?.();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">Bring contacts in</p>
      <p className="text-xs text-gray-600 mt-0.5">A CSV from Follow Up Boss (People → Export), another CRM or a spreadsheet. People already here are matched by email or phone and updated, never added twice.</p>
      <label className="mt-3 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-lg border border-dashed border-gray-400 text-sm font-medium text-gray-800 cursor-pointer hover:border-black">
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={pickFile} disabled={busy} />
        {fileName || 'Choose a CSV file'}
      </label>
      {preview && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-700">{preview.rows} {preview.rows === 1 ? 'row' : 'rows'} found. Check which column holds what:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(preview.fields).map(([field, label]) => (
              <label key={field} className="block">
                <span className="text-xs font-medium text-gray-600">{label}</span>
                <select className={inputClass} value={mapping[field] ?? ''} onChange={(e) => setMapping((m) => {
                  const next = { ...m };
                  if (e.target.value === '') delete next[field]; else next[field] = Number(e.target.value);
                  return next;
                })}>
                  <option value="">Don’t import</option>
                  {preview.headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </label>
            ))}
          </div>
          {preview.sample?.[0] && (
            <p className="text-xs text-gray-500">
              First row: {[['name', 'first_name', 'last_name'].map((f) => (mapping[f] !== undefined ? preview.sample[0][mapping[f]] : '')).filter(Boolean).join(' '), mapping.email !== undefined ? preview.sample[0][mapping.email] : ''].filter(Boolean).join(' · ') || 'nothing mapped yet'}
            </p>
          )}
          <button type="button" className={primaryClass} disabled={busy || (mapping.email === undefined && mapping.phone === undefined)} onClick={run}>
            {busy ? 'Importing…' : `Import ${preview.rows} contacts`}
          </button>
        </div>
      )}
      <Msg msg={msg} />
    </div>
  );
}

export function YourCrm({ token, Section, onModeChange }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await crm.crmSettings(token));
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const pick = async (mode) => {
    const text = mode === 'own'
      ? 'Use this cockpit as your CRM? Nothing will be sent to Follow Up Boss from now on. All your contacts, notes and tasks stay right here.'
      : 'Send leads, notes and tasks to Follow Up Boss again? Everything in the cockpit stays as it is.';
    if (!window.confirm(text)) return;
    setBusy(true);
    setMsg(null);
    try {
      await crm.setCrmMode(token, mode);
      onModeChange?.(mode);
      setMsg({ kind: 'ok', text: mode === 'own' ? 'Done. The cockpit is your CRM now.' : 'Done. Follow Up Boss is back on.' });
      await load();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };
  const download = async () => {
    setBusy(true);
    try {
      await downloadContactsCsv(token);
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Your CRM" description="Where your contacts, notes and tasks live. You can switch any time; switching never deletes anything.">
      {!data ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeCard active={data.mode === 'own'} busy={busy} title="This cockpit" onPick={() => pick('own')}>
              Leads, stages, tags, notes, tasks, action plans and the team inbox all live here. Nothing goes to Follow Up Boss, and there’s nothing else to pay for.
            </ModeCard>
            <ModeCard active={data.mode === 'fub'} busy={busy} title="Follow Up Boss" onPick={() => pick('fub')}>
              New leads, notes and tasks are also sent to your Follow Up Boss account. Pick this if your team works in Follow Up Boss every day.
              {data.mode === 'fub' && !data.fub_connected ? ' Connect it below under Follow Up Boss.' : ''}
            </ModeCard>
          </div>
          <p className="text-sm text-gray-600">
            Here now: <span className="font-semibold text-gray-900">{data.counts.contacts}</span> contacts, {data.counts.notes} notes, {data.counts.open_tasks} open tasks, {data.counts.on_plans} on action plans.
          </p>
          <div className="rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">Take everything with you</p>
              <p className="text-xs text-gray-600 mt-0.5">One spreadsheet with every contact, their notes, tasks, tags, stage, agent and plans.</p>
            </div>
            <button type="button" className={`${secondaryClass} sm:ml-auto shrink-0`} onClick={download} disabled={busy}>Download contacts (CSV)</button>
          </div>
          <ImportContacts token={token} onDone={load} />
        </div>
      )}
      <Msg msg={msg} />
    </Section>
  );
}

// ------------------------------------------------------------ Lead sources

const SOURCE_ORDER = ['zillow', 'realtor', 'homes', 'facebook', 'zapier', 'webhook', 'email'];

function RoutingEditor({ token, data, onSaved }) {
  const [mode, setMode] = useState(data.routing.mode);
  const [rules, setRules] = useState(data.routing.rules);
  const [rotation, setRotation] = useState(data.routing.rotation);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const agents = data.team;
  const setRule = (i, patch) => setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await crm.saveIntake(token, { routing: { mode, rules, rotation } });
      onSaved(d);
      setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Who gets new leads</p>
      <div className="space-y-1">
        {[['round_robin', 'Take turns', 'Each new lead goes to the next agent in line.'], ['pool', 'Shared pool', 'New leads wait unassigned until someone claims them.']].map(([k, label, help]) => (
          <label key={k} className="flex items-start gap-2 text-sm text-gray-800">
            <input type="radio" name="routing-mode" className="mt-1 w-4 h-4" checked={mode === k} onChange={() => setMode(k)} />
            <span><span className="font-semibold">{label}.</span> {help}</span>
          </label>
        ))}
      </div>
      {mode === 'round_robin' && (
        <fieldset>
          <legend className="text-xs font-medium text-gray-600">In the rotation (none checked = every agent)</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {agents.map((a) => (
              <label key={a.id} className="inline-flex items-center gap-1.5 text-sm min-h-[36px] px-2.5 rounded-lg border border-gray-200">
                <input type="checkbox" className="w-4 h-4" checked={rotation.includes(a.id)} onChange={(e) => setRotation((r) => (e.target.checked ? [...r, a.id] : r.filter((x) => x !== a.id)))} />
                {a.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <p className="text-xs font-medium text-gray-600">Rules first (top to bottom), then the above</p>
        <ul className="mt-1 space-y-2">
          {rules.map((r, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_0.8fr_0.8fr_1fr_auto] items-end rounded-lg bg-gray-50 p-2">
              <label className="block"><span className="text-[11px] text-gray-500">From</span>
                <select className={inputClass} value={r.source || ''} onChange={(e) => setRule(i, { source: e.target.value })}>
                  <option value="">Any source</option>
                  {Object.entries(data.sources).filter(([k]) => k !== 'import').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
              <label className="block"><span className="text-[11px] text-gray-500">City</span>
                <input className={inputClass} value={r.city || ''} onChange={(e) => setRule(i, { city: e.target.value })} placeholder="Any" />
              </label>
              <label className="block"><span className="text-[11px] text-gray-500">Price from</span>
                <input className={inputClass} inputMode="numeric" value={r.min_price || ''} onChange={(e) => setRule(i, { min_price: e.target.value.replace(/\D/g, '') })} placeholder="$" />
              </label>
              <label className="block"><span className="text-[11px] text-gray-500">Price to</span>
                <input className={inputClass} inputMode="numeric" value={r.max_price || ''} onChange={(e) => setRule(i, { max_price: e.target.value.replace(/\D/g, '') })} placeholder="$" />
              </label>
              <label className="block"><span className="text-[11px] text-gray-500">Goes to</span>
                <select className={inputClass} value={r.agent_id || ''} onChange={(e) => setRule(i, { agent_id: Number(e.target.value) || null })}>
                  <option value="">Pick someone</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <button type="button" className="min-h-[44px] px-3 rounded-lg border border-gray-300 text-sm text-red-700 bg-white" onClick={() => setRules((x) => x.filter((_, j) => j !== i))} aria-label={`Remove rule ${i + 1}`}>Remove</button>
            </li>
          ))}
        </ul>
        <button type="button" className={`${secondaryClass} mt-2`} onClick={() => setRules((r) => [...r, { source: '', city: '', min_price: '', max_price: '', agent_id: null }])}>Add a rule</button>
      </div>
      <button type="button" className={primaryClass} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
      <Msg msg={msg} />
    </div>
  );
}

function FacebookSetup({ token, data, onSaved }) {
  const [pageToken, setPageToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const save = async (e) => {
    e.preventDefault();
    const facebook = {};
    if (pageToken.trim()) facebook.page_token = pageToken.trim();
    if (appSecret.trim()) facebook.app_secret = appSecret.trim();
    if (!Object.keys(facebook).length) return;
    setBusy(true);
    setMsg(null);
    try {
      onSaved(await crm.saveIntake(token, { facebook }));
      setPageToken('');
      setAppSecret('');
      setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const fb = data.facebook;
  return (
    <form onSubmit={save} className="rounded-xl border border-gray-200 p-4 space-y-2">
      <p className="text-sm font-semibold text-gray-900">Facebook lead ads</p>
      <p className="text-xs text-gray-600">In your Facebook app’s Webhooks settings, subscribe the Page to <span className="font-mono">leadgen</span> with the callback link and verify token below. Then paste the Page access token and app secret here.</p>
      <Copyable label="Callback link" value={data.endpoints.facebook} />
      <Copyable label="Verify token" value={fb.verify_token} />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block"><span className="text-xs font-medium text-gray-600">Page access token {fb.page_token_set ? '(saved)' : ''}</span>
          <input type="password" autoComplete="off" className={inputClass} value={pageToken} onChange={(e) => setPageToken(e.target.value)} placeholder={fb.page_token_set ? '••••••••' : 'Paste token'} />
        </label>
        <label className="block"><span className="text-xs font-medium text-gray-600">App secret {fb.app_secret_set ? '(saved)' : ''}</span>
          <input type="password" autoComplete="off" className={inputClass} value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder={fb.app_secret_set ? '••••••••' : 'Paste secret'} />
        </label>
      </div>
      <button type="submit" className={secondaryClass} disabled={busy || (!pageToken.trim() && !appSecret.trim())}>{busy ? 'Saving…' : 'Save Facebook details'}</button>
      <Msg msg={msg} />
    </form>
  );
}

function TryLeadEmail({ token }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const run = async () => {
    setError(null);
    try {
      setResult(await crm.testIntake(token, { text }));
    } catch (e) {
      setError(e.message);
    }
  };
  const lead = result?.lead;
  return (
    <details className="rounded-xl border border-gray-200 p-4">
      <summary className="text-sm font-semibold text-gray-900 cursor-pointer min-h-[28px]">Try a lead email</summary>
      <p className="text-xs text-gray-600 mt-1">Paste the text of a lead email to see what we’d read from it. Nothing is saved.</p>
      <label className="sr-only" htmlFor="intake-try">Lead email text</label>
      <textarea id="intake-try" rows={5} className={`${inputClass} mt-2 py-2`} value={text} onChange={(e) => setText(e.target.value)} />
      <button type="button" className={`${secondaryClass} mt-2`} onClick={run} disabled={!text.trim()}>Read it</button>
      {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      {lead && (
        <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-x-2 gap-y-1 text-sm">
          <dt className="text-gray-500">From</dt><dd>{result.source_label}</dd>
          {[['Name', lead.name], ['Email', lead.email], ['Phone', lead.phone], ['Home', lead.property_address || lead.property_url], ['Price', lead.price ? `$${Number(lead.price).toLocaleString('en-US')}` : null], ['Message', lead.message]].map(([k, v]) => (
            <React.Fragment key={k}><dt className="text-gray-500">{k}</dt><dd className="break-words">{v || <span className="text-gray-400">not found</span>}</dd></React.Fragment>
          ))}
        </dl>
      )}
    </details>
  );
}

const OUTCOME = { created: 'New lead', duplicate: 'Already here, updated', rejected: 'Not added' };

export function LeadSources({ token, Section }) {
  const [data, setData] = useState(null);
  const [replyTo, setReplyTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const take = (d) => { setData(d); setReplyTo(d.inbound.reply_to || ''); };
  const load = useCallback(async () => {
    try {
      take(await crm.intake(token));
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const saveReplyTo = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      take(await crm.saveIntake(token, { inbound: { reply_to: replyTo } }));
      setMsg({ kind: 'ok', text: 'Saved.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  const rotate = async () => {
    if (!window.confirm('Make new links? The old ones stop working, so you’ll need to update every portal and zap that uses them.')) return;
    setBusy(true);
    try {
      take(await crm.newIntakeKey(token));
      setMsg({ kind: 'ok', text: 'New links are ready. Update your portals and zaps.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Lead sources" description="Bring in leads from Zillow, Realtor.com, Homes.com, Facebook and your web forms. Each one lands in the cockpit and the team inbox, tagged with where it came from.">
      {!data ? <p className="text-sm text-gray-500">Loading…</p> : (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Your links</p>
            <p className="text-xs text-gray-600 mt-0.5">
              Portals send leads by email. Have your email service (Postmark, Resend or SendGrid inbound) post the lead emails to the matching link, or forward every lead email to one address that posts to “Any lead email”. Zapier and web forms post JSON with name, email, phone and message. Keep these links private.
            </p>
            <div className="mt-2">
              {SOURCE_ORDER.filter((k) => k !== 'facebook').map((k) => {
                const label = { zillow: 'Zillow', realtor: 'Realtor.com', homes: 'Homes.com', zapier: 'Zapier', webhook: 'Web forms (JSON)', email: 'Any lead email (we work out the source)' }[k];
                return <Copyable key={k} label={label} value={data.endpoints[k]} />;
              })}
            </div>
            <button type="button" className={`${secondaryClass} mt-2`} onClick={rotate} disabled={busy}>Make new links</button>
          </div>

          <form onSubmit={saveReplyTo} className="rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Email replies to the team inbox</p>
            <p className="text-xs text-gray-600">Set your email service to post incoming mail for this address to the link below. Emails from the cockpit and action plans use it as the reply-to, so answers land in the team inbox.</p>
            <label className="block"><span className="text-xs font-medium text-gray-600">Reply-to address</span>
              <input type="email" className={inputClass} value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="team@reply.yourbrokerage.com" />
            </label>
            <Copyable label="Inbound email link" value={data.endpoints.inbound_email} />
            <button type="submit" className={secondaryClass} disabled={busy}>Save reply-to</button>
          </form>

          <RoutingEditor token={token} data={data} onSaved={take} />
          <FacebookSetup token={token} data={data} onSaved={take} />
          <TryLeadEmail token={token} />

          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">Recent leads</p>
            {data.recent.length === 0 ? <p className="text-sm text-gray-500 mt-1">None yet.</p> : (
              <ul className="mt-2 divide-y divide-gray-100">
                {data.recent.map((r) => (
                  <li key={r.id} className="py-2 text-sm flex flex-wrap gap-x-2">
                    <span className="text-gray-400 text-xs w-28 shrink-0">{new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="font-semibold text-gray-900">{data.sources[r.source] || r.source}</span>
                    <span className={r.outcome === 'rejected' ? 'text-red-700' : 'text-gray-700'}>{OUTCOME[r.outcome] || r.outcome}</span>
                    <span className="text-gray-600 min-w-0 break-words">{r.summary || r.error}</span>
                    {r.agent_name && <span className="text-gray-500">→ {r.agent_name}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
      <Msg msg={msg} />
    </Section>
  );
}
