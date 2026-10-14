/**
 * Platform console — the product's own identity: its name, domains, support
 * and sending addresses, logo and colors. Brokerages see these on signup,
 * the platform's marketing site and platform emails; never SAA's. Each field
 * shows where its value comes from (set here, an env var, or the default);
 * clearing a field here goes back to the env var, then the default.
 *
 * Only rendered for the platform owner (AdminPage, Brokerages tab).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api.js';

const GOLD = 'var(--brand-accent)';

const HELP = {
  name: 'Shown on signup, the marketing site, the console and platform emails.',
  short_name: 'For tight spaces: the marketing site header and app icon.',
  legal_name: 'The company behind the product, in footers.',
  marketing_domain: 'Your product site for brokerages, e.g. getyourproduct.com. Not saahomes.com.',
  app_domain: 'Brokerages get <slug>.<this domain> at signup. Needs a wildcard DNS record pointing here.',
  cname_target: 'What brokerages point their own domain at. Defaults to cname.<subdomain base>.',
  support_email: 'Where brokerages write for help. Defaults to support@<marketing domain>.',
  from_email: 'Platform mail, and brokerages without their own sending domain, come from this address. Your mail provider must allow it.',
  logo_url: 'An https:// image for the marketing site and signup.',
  icon_url: 'A square https:// image for browser tabs and the app icon.',
  primary_color: 'Like #111111.',
  accent_color: 'Buttons and links, like #2563eb.',
};

const SOURCE = {
  console: ['Set here', 'text-blue-700 bg-blue-50'],
  env: ['From env', 'text-gray-700 bg-gray-100'],
  default: ['Default', 'text-gray-500 bg-gray-50'],
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

export default function PlatformIdentityPanel({ token }) {
  const [view, setView] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest('/api/platform/settings', { headers: auth(token) });
      setView(res.data);
      setDraft({});
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Could not load the platform settings' });
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (e) => {
    e.preventDefault();
    if (!Object.keys(draft).length) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await apiRequest('/api/platform/settings', {
        method: 'PUT',
        headers: auth(token),
        body: JSON.stringify(draft),
      });
      setView(res.data);
      setDraft({});
      setNote({ kind: 'ok', text: 'Saved. Signup, the marketing site and platform emails use it now.' });
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

  const identity = view?.identity;

  return (
    <section className="bg-white rounded-lg shadow p-4 sm:p-6" aria-labelledby="platform-identity-title">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 id="platform-identity-title" className="text-lg font-semibold text-gray-900">Platform identity</h2>
          <p className="text-sm text-gray-500 mt-1">
            {identity
              ? <>Brokerages see <span className="font-semibold text-gray-900">{identity.name}</span>{identity.marketing_domain ? <> at {identity.marketing_domain}</> : null}, never SAA.</>
              : 'The product’s own name, domains and sender.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium hover:border-black self-start"
        >
          {open ? 'Close' : 'Edit'}
        </button>
      </div>

      {open && view ? (
        <form onSubmit={save} className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {view.fields.map((f) => {
              const [label, cls] = SOURCE[f.source] || SOURCE.default;
              const value = f.key in draft ? draft[f.key] ?? '' : f.override ?? '';
              return (
                <label key={f.key} className="block">
                  <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    {f.label}
                    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
                  </span>
                  <input
                    type={f.key.endsWith('email') ? 'email' : 'text'}
                    value={value}
                    placeholder={f.value || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <span className="block text-xs text-gray-500 mt-1">
                    {HELP[f.key]} Env: <code className="font-mono">{f.env}</code>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || !Object.keys(draft).length}
              className="min-h-[44px] px-5 rounded-lg text-white font-semibold disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <span className="text-xs text-gray-500">Leave a field empty to use its env var, then the default.</span>
          </div>
        </form>
      ) : null}
      {note ? (
        <p role={note.kind === 'error' ? 'alert' : 'status'} className={`mt-3 text-sm ${note.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          {note.text}
        </p>
      ) : null}
    </section>
  );
}
