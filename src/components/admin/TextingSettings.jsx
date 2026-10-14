/**
 * "Texting" settings card (owner): is texting ready, which number texts go
 * from, quiet-hours time zone, who gets alerts for unassigned hot leads, and
 * the carrier (10DLC) registration checklist with the exact wording to paste.
 * GET/PATCH /api/admin/settings/sms
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm } from '../../utils/crmApi.js';

const TIME_ZONES = [
  ['America/New_York', 'Eastern'],
  ['America/Chicago', 'Central'],
  ['America/Denver', 'Mountain'],
  ['America/Phoenix', 'Arizona'],
  ['America/Los_Angeles', 'Pacific'],
  ['America/Anchorage', 'Alaska'],
  ['Pacific/Honolulu', 'Hawaii'],
];

const inputClass =
  'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';

function CopyText({ label, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the text is still selectable */
    }
  };
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-600">{label}</p>
        <button type="button" onClick={copy} className="min-h-[32px] px-2 text-xs font-semibold text-gray-700 underline">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-words whitespace-pre-wrap select-all">{text}</p>
    </div>
  );
}

function Step({ n, title, children }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <div className="text-sm text-gray-600">{children}</div>
      </div>
    </li>
  );
}

export default function TextingSettings({ token }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ messaging_service_sid: '', from_number: '', time_zone: 'America/Denver' });
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [showKit, setShowKit] = useState(false);

  const apply = (d) => {
    setData(d);
    setForm({
      messaging_service_sid: d.settings.messaging_service_sid || '',
      from_number: d.settings.from_number || '',
      time_zone: d.settings.time_zone || 'America/Denver',
    });
    setRegistered(!!d.status.enabled);
  };

  const load = useCallback(async () => {
    try {
      apply(await crm.smsSettings(token));
    } catch (e) {
      setNote({ kind: 'error', text: e.message });
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const save = async (body, ok) => {
    setBusy(true);
    setNote(null);
    try {
      apply(await crm.saveSmsSettings(token, body));
      setNote({ kind: 'ok', text: ok });
    } catch (e) {
      setNote({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (!data) {
    return note ? <p className="text-sm text-red-700">{note.text}</p> : null;
  }
  const { status, kit, stats, numbers, hot_leads: hot } = data;
  const notSetUp = status.reason === 'not_set_up';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" aria-labelledby="texting-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="texting-heading" className="text-lg font-bold text-gray-900">Texting</h2>
        <span
          className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
            status.ready ? 'bg-green-50 text-green-700' : notSetUp ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {status.ready ? 'On' : notSetUp ? 'Not set up' : status.enabled ? 'Needs a number' : 'Off'}
        </span>
      </div>
      <p className="text-sm text-gray-500 mt-1">
        Text alerts on saved searches, tour confirmations and reminders, and two-way texts with your leads. Only people who opted in get texts, only between 8am and 9pm, and STOP always works.
      </p>

      {status.message && (
        <div className={`mt-3 border px-3 py-2 rounded-lg text-sm ${notSetUp ? 'bg-gray-50 border-gray-200 text-gray-700' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
          {status.message}
          {notSetUp && ' Nothing will be texted until it is. Your agents can still call and email from the cockpit.'}
        </div>
      )}
      {status.ready && (
        <p className="mt-3 text-sm text-gray-700">
          Last 30 days: <strong>{stats.sent_30d}</strong> sent, <strong>{stats.received_30d}</strong> received, <strong>{stats.opt_outs}</strong> opted out in total.
        </p>
      )}

      {!notSetUp && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Messaging service ID</span>
            <input
              value={form.messaging_service_sid}
              onChange={(e) => setForm((f) => ({ ...f, messaging_service_sid: e.target.value }))}
              placeholder={status.shared ? 'Using the shared platform number' : 'MG…'}
              autoComplete="off"
              className={inputClass}
            />
            <span className="text-xs text-gray-500">From your registered campaign. Leave blank to use a single number.</span>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Or a single texting number</span>
            <input
              type="tel"
              value={form.from_number}
              onChange={(e) => setForm((f) => ({ ...f, from_number: e.target.value }))}
              placeholder="(555) 555-0100"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Quiet hours time zone</span>
            <select value={form.time_zone} onChange={(e) => setForm((f) => ({ ...f, time_zone: e.target.value }))} className={inputClass}>
              {TIME_ZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              {!TIME_ZONES.some(([v]) => v === form.time_zone) && <option value={form.time_zone}>{form.time_zone}</option>}
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => save(form, 'Saved.')}
              className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] bg-[color:var(--brand-accent)] disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {numbers && numbers.length > 0 && (
        <p className="mt-3 text-sm text-gray-700">
          Texts go out from {numbers.join(', ')}{status.shared ? ' (shared platform number)' : ''}.
        </p>
      )}

      {!notSetUp && (
        <div className="mt-4 rounded-lg border border-gray-200 p-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={registered} onChange={(e) => setRegistered(e.target.checked)} className="mt-1 w-5 h-5" />
            <span className="text-sm text-gray-800">
              Our brand and texting campaign are registered with the carriers (10DLC), and the opt-in wording below is on our site.
            </span>
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {!status.enabled ? (
              <button
                type="button"
                disabled={busy || !registered}
                onClick={() => save({ enabled: true }, 'Texting is on.')}
                className="min-h-[44px] px-5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50"
              >
                Turn texting on
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => save({ enabled: false }, 'Texting is off. Nothing will be texted.')}
                className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
              >
                Turn texting off
              </button>
            )}
          </div>
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-semibold text-gray-900">Hot leads nobody has claimed</p>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          {[
            ['owners', 'Alert the owners'],
            ['round_robin', 'Assign to the next agent (round-robin) and alert them'],
          ].map(([v, l]) => (
            <label key={v} className={`flex items-center gap-2 min-h-[44px] px-3 rounded-lg border text-sm ${hot.unassigned === v ? 'border-black bg-gray-50' : 'border-gray-300'}`}>
              <input type="radio" name="hot-unassigned" checked={hot.unassigned === v} disabled={busy} onChange={() => save({ hot_leads_unassigned: v }, 'Saved.')} />
              {l}
            </label>
          ))}
        </div>
      </div>

      {note && (
        <div className={`mt-3 border px-3 py-2 rounded-lg text-sm ${note.kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`} role="status">
          {note.text}
        </div>
      )}

      <div className="mt-5 border-t border-gray-100 pt-4">
        <button type="button" onClick={() => setShowKit((v) => !v)} aria-expanded={showKit} className="min-h-[44px] text-sm font-semibold text-gray-900 underline">
          {showKit ? 'Hide' : 'Show'} the carrier registration checklist
        </button>
        {showKit && (
          <ol className="mt-3 space-y-4">
            <Step n={1} title="Register your brand">
              Use your legal name exactly as on your EIN: <strong>{kit.legal_name}</strong>. Website: {kit.website}.
            </Step>
            <Step n={2} title="Register the campaign">
              Use case: {kit.use_case}.
              <CopyText label="Campaign description" text={kit.campaign_description} />
            </Step>
            <Step n={3} title="Show how people opt in">
              {kit.opt_in_where}
              <CopyText label="Opt-in wording (already on your save-search form)" text={kit.opt_in_wording} />
            </Step>
            <Step n={4} title="Paste sample messages">
              {kit.samples.map((s, i) => <CopyText key={i} label={`Sample ${i + 1}`} text={s} />)}
            </Step>
            <Step n={5} title="Opt-out, help and privacy">
              Keywords: {kit.keywords.opt_out.join(', ')} to stop; {kit.keywords.opt_in.join(', ')} to restart; {kit.keywords.help.join(', ')} for help.
              <CopyText label="HELP reply" text={kit.help_reply} />
              <CopyText label="STOP reply" text={kit.stop_reply} />
              <CopyText label="Privacy policy line" text={`${kit.privacy_line} ${kit.message_frequency} Message and data rates may apply.`} />
            </Step>
            <Step n={6} title="Point your number here">
              In your messaging service, set incoming messages and delivery status to these addresses.
              <CopyText label="Incoming messages" text={kit.webhook_url} />
              <CopyText label="Delivery status" text={kit.status_url} />
            </Step>
            <Step n={7} title="Turn texting on">
              Once the carriers approve the campaign, add the messaging service ID above, tick the box and turn texting on.
            </Step>
          </ol>
        )}
      </div>
    </section>
  );
}
