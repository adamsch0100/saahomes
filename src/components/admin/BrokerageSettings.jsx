/**
 * Brokerage settings (owner or platform owner): the brand the site, emails and
 * app show; the email sender; the website domain; lead routing; required
 * two-step sign-in; Follow Up Boss; and a test email.
 * GET/PATCH /api/admin/settings (+ asset, email-domain, domain, test-email).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  getBrokerageSettings,
  patchBrokerageSettings,
  uploadBrokerageAsset,
  createBrokerageEmailDomain,
  verifyBrokerageEmailDomain,
  setBrokerageSiteDomain,
  checkBrokerageSiteDomain,
  sendBrokerageTestEmail,
} from '../../utils/api.js';
import { normalizeHex, readableOn } from '../../utils/brandTheme.js';
import { readImageAsDataUrl } from '../../utils/imageUpload.js';

const GOLD = 'var(--brand-accent)';

const BRAND_FIELDS = [
  { key: 'name', label: 'Brand name', placeholder: 'Front Range Realty', hint: 'Shown in the header, emails and the app.' },
  { key: 'legal_name', label: 'Legal name', placeholder: 'Front Range Realty, LLC' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 555-0100', type: 'tel' },
  { key: 'email', label: 'Email', placeholder: 'hello@yourbrokerage.com', type: 'email' },
  { key: 'tagline', label: 'Tagline', placeholder: 'Homes, people, neighborhoods', wide: true },
  { key: 'address', label: 'Office address', placeholder: '123 Main St, Springfield, CO 80000', wide: true },
  { key: 'license_line', label: 'License line', placeholder: 'Licensed real estate brokerage in Colorado', wide: true },
  { key: 'market_name', label: 'Market name', placeholder: 'Front Range', hint: 'The area you serve, as buyers say it.' },
];

const LEAD_OPTIONS = [
  { value: 'own', label: 'Own leads only', help: 'Each agent sees only the leads assigned to them. You see everything.' },
  {
    value: 'own_and_unassigned',
    label: 'Own leads + unclaimed',
    help: 'Agents see their own leads and any lead nobody has claimed yet, so new leads get picked up fast.',
  },
  { value: 'all', label: 'Everyone sees everything', help: 'Every agent sees every lead. Good for small teams that share work.' },
];

const inputClass =
  'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';
const primaryClass =
  'min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] disabled:opacity-50';
const secondaryClass =
  'min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50';

function Section({ title, description, children }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {description ? <p className="text-sm text-gray-500 mt-1">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Note({ kind = 'ok', children }) {
  if (!children) return null;
  const cls =
    kind === 'error'
      ? 'bg-red-50 border-red-200 text-red-800'
      : 'bg-green-50 border-green-200 text-green-800';
  return <div className={`mt-3 border px-3 py-2 rounded-lg text-sm ${cls}`}>{children}</div>;
}

function StatusPill({ status }) {
  const map = {
    verified: 'bg-green-50 text-green-700',
    active: 'bg-green-50 text-green-700',
    pending: 'bg-amber-50 text-amber-700',
    failed: 'bg-red-50 text-red-700',
    none: 'bg-gray-100 text-gray-500',
  };
  if (!status) return null;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${map[status] || map.none}`}>
      {status}
    </span>
  );
}

function CopyButton({ value }) {
  const [msg, setMsg] = useState(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value || ''));
      setMsg('Copied');
    } catch {
      setMsg('Select and copy');
    }
    setTimeout(() => setMsg(null), 1800);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 min-h-[32px] px-2.5 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-black"
    >
      {msg || 'Copy'}
    </button>
  );
}

/** DNS records to add at the domain's registrar, each value copyable. */
function DnsTable({ records }) {
  if (!records?.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Value</th>
            {records.some((r) => r.status) ? <th className="px-3 py-2">Status</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map((r, i) => (
            <tr key={`${r.type}-${r.name}-${i}`} className="align-top">
              <td className="px-3 py-2 font-mono text-gray-900">{r.type}</td>
              <td className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <code className="font-mono text-gray-900 break-all">{r.name}</code>
                  <CopyButton value={r.name} />
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex items-start gap-2">
                  <code className="font-mono text-gray-900 break-all max-w-[22rem]">{r.value}</code>
                  <CopyButton value={r.value} />
                </div>
              </td>
              {records.some((x) => x.status) ? (
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Which homes the site shows. The MLS approves each brokerage; until then the
 * site shows sample homes. Read-only except the service areas.
 */
function ListingsSection({ listings, busy, onSaveAreas, note }) {
  const [areas, setAreas] = useState((listings?.service_areas || []).join(', '));
  useEffect(() => {
    setAreas((listings?.service_areas || []).join(', '));
  }, [listings?.service_areas]);
  if (!listings) return null;
  const live = listings.mode === 'live';
  const ires = (listings.feeds || []).find((f) => f.key === 'ires');
  const steps = [
    { done: live || ['pending', 'approved'].includes(ires?.status), text: 'Apply to IRES as a website data vendor through MLS Grid (mlsgrid.com). Name us as your website provider.' },
    { done: live, text: 'Your managing broker signs the IRES data license for your site.' },
    { done: live, text: 'Tell us when IRES approves you. We switch your site to live listings, usually the same day.' },
  ];
  return (
    <Section title="Listings" description="Which homes buyers see on your site.">
      <div className="space-y-4 text-sm">
        <div className={`rounded-lg border p-3 ${live ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <p className={`font-semibold ${live ? 'text-green-900' : 'text-amber-900'}`}>{listings.headline}</p>
          <p className={`mt-1 ${live ? 'text-green-800' : 'text-amber-800'}`}>
            {live
              ? `Every home shows who it's listed with and your MLS's notice. Recent sales are ${listings.sold ? 'on' : 'off'}.`
              : 'Buyers can try everything (search, map, saved homes, alerts) on sample homes, each clearly labeled as a sample. No real listing shows until your MLS approves your site.'}
          </p>
          {listings.suspended?.length ? (
            <p className="mt-1 text-red-700">Paused: {listings.suspended.join(', ')}. Contact us to turn it back on.</p>
          ) : null}
        </div>
        {!live && (
          <div>
            <p className="font-semibold text-gray-900">What to do next</p>
            <ol className="mt-2 space-y-2">
              {steps.map((st, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      st.done ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {st.done ? '✓' : i + 1}
                  </span>
                  <span className="text-gray-700">{st.text}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSaveAreas(areas.split(',').map((a) => a.trim()).filter(Boolean));
          }}
        >
          <label className="block">
            <span className="font-semibold text-gray-900">Service areas</span>
            <span className="block text-gray-500">
              Towns or counties your search opens on, separated by commas. Buyers can still search anywhere.
            </span>
            <input
              type="text"
              value={areas}
              onChange={(e) => setAreas(e.target.value)}
              placeholder="Fort Collins, Loveland, Weld County"
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={busy} className={`${secondaryClass} mt-2`}>
            {busy ? 'Saving…' : 'Save service areas'}
          </button>
        </form>
        <Note kind={note?.kind}>{note?.text}</Note>
      </div>
    </Section>
  );
}

function brandFormFrom(brand) {
  const out = {};
  for (const f of BRAND_FIELDS) out[f.key] = brand?.[f.key] || '';
  out.primary_color = brand?.primary_color || '';
  out.accent_color = brand?.accent_color || '';
  out.from_name = brand?.from_name || '';
  out.reply_to = brand?.reply_to || '';
  return out;
}

/** '' → null so a cleared field is unset (the site then leaves it out). */
function brandPatchFrom(form) {
  const out = {};
  for (const [k, v] of Object.entries(form)) {
    const t = String(v || '').trim();
    out[k] = t || null;
  }
  return out;
}

function ColorField({ label, value, onChange, fallback }) {
  const hex = normalizeHex(value);
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="color"
          value={hex || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 rounded-lg border border-gray-300 bg-white p-1 cursor-pointer"
          aria-label={`${label} picker`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
          aria-label={`${label} hex`}
        />
      </div>
      {value && !hex ? <span className="text-xs text-red-600">Use a hex color like #1f3a5f</span> : null}
    </label>
  );
}

function BrandPreview({ form, logoUrl }) {
  const primary = normalizeHex(form.primary_color) || '#111111';
  const accent = normalizeHex(form.accent_color) || normalizeHex(form.primary_color) || '#374151';
  const onAccent = readableOn(accent);
  const name = form.name.trim();
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: primary }}>
        {logoUrl ? (
          <img src={logoUrl} alt={name || 'Logo'} className="h-8 w-auto max-w-[10rem] object-contain" />
        ) : (
          <span className="text-sm font-extrabold tracking-wide truncate" style={{ color: accent }}>
            {name || 'Your brand name'}
          </span>
        )}
        {form.phone.trim() ? <span className="text-xs text-white/80">{form.phone.trim()}</span> : null}
      </div>
      <div className="bg-white px-4 py-5">
        <p className="text-base font-bold text-gray-900">{name || 'Your brand name'}</p>
        {form.tagline.trim() ? <p className="text-sm text-gray-500 mt-0.5">{form.tagline.trim()}</p> : null}
        <span
          className="mt-3 inline-flex items-center min-h-[36px] px-4 rounded-lg text-sm font-semibold"
          style={{ backgroundColor: accent, color: onAccent }}
        >
          Search homes
        </span>
        {(form.legal_name.trim() || form.license_line.trim()) && (
          <p className="text-[11px] text-gray-400 mt-4">
            {[form.legal_name.trim(), form.license_line.trim()].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BrokerageSettings({ token }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState(brandFormFrom(null));
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandNote, setBrandNote] = useState(null);
  const [assetBusy, setAssetBusy] = useState(null); // 'logo' | 'icon'
  const [assetNote, setAssetNote] = useState(null);

  const [routingNote, setRoutingNote] = useState(null);
  const [areasNote, setAreasNote] = useState(null);
  const [securityNote, setSecurityNote] = useState(null);
  const [quickBusy, setQuickBusy] = useState(null);

  const [emailDomain, setEmailDomain] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNote, setEmailNote] = useState(null);

  const [siteDomain, setSiteDomain] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteNote, setSiteNote] = useState(null);

  const [fubKey, setFubKey] = useState('');
  const [fubBusy, setFubBusy] = useState(false);
  const [fubNote, setFubNote] = useState(null);

  const [testBusy, setTestBusy] = useState(false);
  const [testNote, setTestNote] = useState(null);

  const adopt = useCallback((data) => {
    if (!data) return;
    setSettings(data);
    setForm(brandFormFrom(data.brand));
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await getBrokerageSettings(token);
      adopt(res.data);
    } catch (err) {
      setLoadError(err.message || 'Could not load settings');
    } finally {
      setLoading(false);
    }
  }, [token, adopt]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const saveBrand = async (e) => {
    e.preventDefault();
    for (const k of ['primary_color', 'accent_color']) {
      if (form[k].trim() && !normalizeHex(form[k])) {
        setBrandNote({ kind: 'error', text: 'Colors need to be hex values like #1f3a5f.' });
        return;
      }
    }
    setBrandBusy(true);
    setBrandNote(null);
    try {
      const patch = brandPatchFrom(form);
      if (patch.primary_color) patch.primary_color = normalizeHex(patch.primary_color);
      if (patch.accent_color) patch.accent_color = normalizeHex(patch.accent_color);
      const res = await patchBrokerageSettings(token, { brand: patch });
      adopt(res.data);
      setBrandNote({ kind: 'ok', text: 'Saved. Your site, emails and app use it from now on.' });
    } catch (err) {
      setBrandNote({ kind: 'error', text: err.message || 'Could not save' });
    } finally {
      setBrandBusy(false);
    }
  };

  const uploadAsset = async (kind, file) => {
    setAssetBusy(kind);
    setAssetNote(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const res = await uploadBrokerageAsset(token, kind, dataUrl);
      setSettings((s) =>
        s ? { ...s, brand: { ...s.brand, [`${kind}_url`]: res.url || s.brand?.[`${kind}_url`] } } : s
      );
      setAssetNote({ kind: 'ok', text: kind === 'logo' ? 'Logo updated.' : 'App icon updated.' });
    } catch (err) {
      setAssetNote({ kind: 'error', text: err.message || 'Upload failed' });
    } finally {
      setAssetBusy(null);
    }
  };

  const quickPatch = async (body, which, setNote, okText) => {
    setQuickBusy(which);
    setNote(null);
    try {
      const res = await patchBrokerageSettings(token, body);
      adopt(res.data);
      setNote({ kind: 'ok', text: okText });
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Could not save' });
    } finally {
      setQuickBusy(null);
    }
  };

  const addEmailDomain = async (e) => {
    e.preventDefault();
    if (!emailDomain.trim()) return;
    setEmailBusy(true);
    setEmailNote(null);
    try {
      const res = await createBrokerageEmailDomain(token, emailDomain.trim());
      setSettings((s) => (s ? { ...s, email: res.data || s.email } : s));
      setEmailDomain('');
      setEmailNote({ kind: 'ok', text: 'Add these records at your domain registrar, then press Verify.' });
    } catch (err) {
      setEmailNote({ kind: 'error', text: err.message || 'Could not add that domain' });
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmailDomain = async () => {
    setEmailBusy(true);
    setEmailNote(null);
    try {
      const res = await verifyBrokerageEmailDomain(token);
      setSettings((s) => (s ? { ...s, email: res.data || s.email } : s));
      const status = res.data?.sending_domain?.status;
      setEmailNote(
        status === 'verified'
          ? { kind: 'ok', text: 'Verified. Emails now go out from your domain.' }
          : { kind: 'ok', text: 'Not verified yet. DNS changes can take up to a few hours; try again later.' }
      );
    } catch (err) {
      setEmailNote({ kind: 'error', text: err.message || 'Could not verify' });
    } finally {
      setEmailBusy(false);
    }
  };

  const addSiteDomain = async (e) => {
    e.preventDefault();
    if (!siteDomain.trim()) return;
    setSiteBusy(true);
    setSiteNote(null);
    try {
      const res = await setBrokerageSiteDomain(token, siteDomain.trim());
      setSettings((s) => (s ? { ...s, site: res.data || s.site } : s));
      setSiteDomain('');
      setSiteNote({ kind: 'ok', text: 'Add the record below at your domain registrar.' });
    } catch (err) {
      setSiteNote({ kind: 'error', text: err.message || 'Could not set that domain' });
    } finally {
      setSiteBusy(false);
    }
  };

  const checkSiteDomain = async () => {
    setSiteBusy(true);
    setSiteNote(null);
    try {
      const res = await checkBrokerageSiteDomain(token);
      setSettings((s) => (s ? { ...s, site: res.data || s.site } : s));
      setSiteNote(
        res.data?.domain_status === 'active'
          ? { kind: 'ok', text: 'Your domain is live.' }
          : { kind: 'ok', text: 'Not live yet. DNS changes can take up to a few hours.' }
      );
    } catch (err) {
      setSiteNote({ kind: 'error', text: err.message || 'Could not check the domain' });
    } finally {
      setSiteBusy(false);
    }
  };

  const connectFub = async (e) => {
    e.preventDefault();
    if (!fubKey.trim()) return;
    setFubBusy(true);
    setFubNote(null);
    try {
      const res = await patchBrokerageSettings(token, { fub_api_key: fubKey.trim() });
      adopt(res.data);
      setFubKey('');
      setFubNote({ kind: 'ok', text: 'Follow Up Boss connected.' });
    } catch (err) {
      setFubNote({ kind: 'error', text: err.message || 'Could not connect Follow Up Boss' });
    } finally {
      setFubBusy(false);
    }
  };

  const disconnectFub = async () => {
    if (!window.confirm('Disconnect Follow Up Boss? New leads stop going there.')) return;
    setFubBusy(true);
    setFubNote(null);
    try {
      const res = await patchBrokerageSettings(token, { fub_api_key: '' });
      adopt(res.data);
      setFubNote({ kind: 'ok', text: 'Disconnected.' });
    } catch (err) {
      setFubNote({ kind: 'error', text: err.message || 'Could not disconnect' });
    } finally {
      setFubBusy(false);
    }
  };

  const sendTest = async () => {
    setTestBusy(true);
    setTestNote(null);
    try {
      const res = await sendBrokerageTestEmail(token);
      setTestNote({ kind: 'ok', text: `Sent to ${res.to || 'your email'}. Check your inbox.` });
    } catch (err) {
      setTestNote({ kind: 'error', text: err.message || 'Could not send the test email' });
    } finally {
      setTestBusy(false);
    }
  };

  if (!settings) {
    return (
      <div className="max-w-3xl space-y-3">
        {loading && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
          </div>
        )}
        {loadError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {loadError}
            <button type="button" onClick={load} className="ml-3 underline">
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  const email = settings.email || {};
  const sending = email.sending_domain || null;
  const site = settings.site || {};
  const fub = settings.fub || {};
  const logoUrl = settings.brand?.logo_url || null;
  const iconUrl = settings.brand?.icon_url || null;

  return (
    <div className="max-w-3xl space-y-6">
      {settings.brokerage?.name ? (
        <p className="text-sm text-gray-500">
          Settings for <span className="font-semibold text-gray-900">{settings.brokerage.name}</span>
        </p>
      ) : null}

      {/* Brand */}
      <Section
        title="Brand"
        description="What your website, emails and app show. Leave a field empty to leave it out."
      >
        <form onSubmit={saveBrand} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {BRAND_FIELDS.map((f) => (
              <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
                <span className="text-xs font-medium text-gray-600">{f.label}</span>
                <input
                  type={f.type || 'text'}
                  value={form[f.key]}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className={inputClass}
                />
                {f.hint ? <span className="text-xs text-gray-400">{f.hint}</span> : null}
              </label>
            ))}
            <ColorField
              label="Primary color (header, app bar)"
              value={form.primary_color}
              onChange={(v) => setField('primary_color', v)}
              fallback="#111111"
            />
            <ColorField
              label="Accent color (buttons, highlights)"
              value={form.accent_color}
              onChange={(v) => setField('accent_color', v)}
              fallback="#374151"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { kind: 'logo', label: 'Logo', help: 'Shown in the header. A wide image on a transparent background works best.', url: logoUrl },
              { kind: 'icon', label: 'App icon', help: 'Square, at least 512×512. Used when someone adds your site to their home screen.', url: iconUrl },
            ].map((a) => (
              <div key={a.kind} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-medium text-gray-600">{a.label}</p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
                    {a.url ? (
                      <img src={a.url} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-[10px] text-gray-400">None</span>
                    )}
                  </div>
                  <label className={`${secondaryClass} inline-flex items-center cursor-pointer`}>
                    {assetBusy === a.kind ? 'Uploading…' : a.url ? 'Replace' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="sr-only"
                      disabled={!!assetBusy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) uploadAsset(a.kind, file);
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">{a.help}</p>
              </div>
            ))}
          </div>
          <Note kind={assetNote?.kind}>{assetNote?.text}</Note>

          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Preview</p>
            <BrandPreview form={form} logoUrl={logoUrl} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={brandBusy} className={primaryClass} style={{ backgroundColor: GOLD }}>
              {brandBusy ? 'Saving…' : 'Save brand'}
            </button>
          </div>
          <Note kind={brandNote?.kind}>{brandNote?.text}</Note>
        </form>
      </Section>

      {/* Email sender */}
      <Section
        title="Email sender"
        description="Who your buyers' alerts, digests and notices come from."
      >
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">From name</span>
              <input
                type="text"
                value={form.from_name}
                onChange={(e) => setField('from_name', e.target.value)}
                placeholder={form.name || 'Your brand name'}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Replies go to</span>
              <input
                type="email"
                value={form.reply_to}
                onChange={(e) => setField('reply_to', e.target.value)}
                placeholder={form.email || 'hello@yourbrokerage.com'}
                className={inputClass}
              />
            </label>
          </div>
          <div>
            <button
              type="button"
              onClick={saveBrand}
              disabled={brandBusy}
              className={secondaryClass}
            >
              {brandBusy ? 'Saving…' : 'Save sender'}
            </button>
          </div>

          {sending ? (
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">{sending.domain}</p>
                <StatusPill status={sending.status} />
              </div>
              {sending.status !== 'verified' ? (
                <p className="text-sm text-gray-500 mt-1">Add these records at your domain registrar, then press Verify.</p>
              ) : (
                <p className="text-sm text-gray-500 mt-1">Emails go out from this domain.</p>
              )}
              <DnsTable records={sending.records} />
              {sending.status !== 'verified' && (
                <button type="button" onClick={verifyEmailDomain} disabled={emailBusy} className={`${primaryClass} mt-3`} style={{ backgroundColor: GOLD }}>
                  {emailBusy ? 'Checking…' : 'Verify'}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-600">
              Emails go out from our shared sender with your name on them
              {form.reply_to || form.email ? `, and replies come to ${form.reply_to || form.email}` : ''}.
            </p>
          )}

          {email.can_use_own_domain && !sending ? (
            <form onSubmit={addEmailDomain} className="flex flex-col sm:flex-row gap-2">
              <label className="flex-1">
                <span className="sr-only">Sending domain</span>
                <input
                  type="text"
                  value={emailDomain}
                  onChange={(e) => setEmailDomain(e.target.value)}
                  placeholder="mail.yourbrokerage.com"
                  className={inputClass.replace('mt-1 ', '')}
                />
              </label>
              <button type="submit" disabled={emailBusy || !emailDomain.trim()} className={primaryClass} style={{ backgroundColor: GOLD }}>
                {emailBusy ? 'Adding…' : 'Send from my domain'}
              </button>
            </form>
          ) : null}
          <Note kind={emailNote?.kind}>{emailNote?.text}</Note>
        </div>
      </Section>

      {/* Website domain */}
      <Section title="Website domain" description="Where buyers find your site.">
        <div className="space-y-3 text-sm">
          {site.url ? (
            <p className="text-gray-600">
              Your site:{' '}
              <a href={site.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-900 underline">
                {site.url}
              </a>
            </p>
          ) : null}
          {site.subdomain_url && site.subdomain_url !== site.url ? (
            <p className="text-gray-500">
              Also at{' '}
              <a href={site.subdomain_url} target="_blank" rel="noopener noreferrer" className="underline">
                {site.subdomain_url}
              </a>
            </p>
          ) : null}
          {site.primary_domain ? (
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">{site.primary_domain}</p>
                <StatusPill status={site.domain_status} />
              </div>
              {site.domain_status !== 'active' ? (
                <p className="text-gray-500 mt-1">
                  Add this record at your domain registrar.
                  {site.automatic === false ? " We'll connect it for you once the record is in place." : ''}
                </p>
              ) : null}
              <DnsTable records={site.dns} />
              {site.domain_status !== 'active' && (
                <button type="button" onClick={checkSiteDomain} disabled={siteBusy} className={`${secondaryClass} mt-3`}>
                  {siteBusy ? 'Checking…' : 'Check status'}
                </button>
              )}
            </div>
          ) : null}
          <form onSubmit={addSiteDomain} className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <span className="sr-only">Your domain</span>
              <input
                type="text"
                value={siteDomain}
                onChange={(e) => setSiteDomain(e.target.value)}
                placeholder={site.primary_domain ? 'Use a different domain' : 'www.yourbrokerage.com'}
                className={inputClass.replace('mt-1 ', '')}
              />
            </label>
            <button type="submit" disabled={siteBusy || !siteDomain.trim()} className={primaryClass} style={{ backgroundColor: GOLD }}>
              {siteBusy ? 'Saving…' : 'Use this domain'}
            </button>
          </form>
          <Note kind={siteNote?.kind}>{siteNote?.text}</Note>
        </div>
      </Section>

      {/* Listings (MLS) */}
      <ListingsSection
        listings={settings.listings}
        busy={quickBusy === 'areas'}
        note={areasNote}
        onSaveAreas={(list) => quickPatch({ service_areas: list }, 'areas', setAreasNote, 'Saved. Your search opens on these areas.')}
      />

      {/* Lead routing */}
      <Section title="Who sees which leads" description="Applies to every agent's console. You always see everything.">
        <fieldset className="space-y-2" disabled={quickBusy === 'routing'}>
          <legend className="sr-only">Lead visibility</legend>
          {LEAD_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${
                settings.lead_visibility === o.value ? 'border-black' : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              <input
                type="radio"
                name="lead_visibility"
                value={o.value}
                checked={settings.lead_visibility === o.value}
                onChange={() =>
                  quickPatch({ lead_visibility: o.value }, 'routing', setRoutingNote, 'Saved.')
                }
                className="mt-1 accent-[color:var(--brand-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
                <span className="block text-sm text-gray-500">{o.help}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Note kind={routingNote?.kind}>{routingNote?.text}</Note>
      </Section>

      {/* Security */}
      <Section title="Security">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!settings.require_2fa}
            disabled={quickBusy === 'security'}
            onChange={(e) =>
              quickPatch(
                { require_2fa: e.target.checked },
                'security',
                setSecurityNote,
                e.target.checked
                  ? 'Two-step sign-in is now required. Anyone without it sets it up at their next sign-in.'
                  : 'Two-step sign-in is now optional.'
              )
            }
            className="mt-1 h-4 w-4 accent-[color:var(--brand-accent)]"
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">Require two-step sign-in</span>
            <span className="block text-sm text-gray-500">
              Everyone on your team (you and your agents) must use a code from an authenticator app when they sign in.
            </span>
          </span>
        </label>
        <Note kind={securityNote?.kind}>{securityNote?.text}</Note>
      </Section>

      {/* Follow Up Boss */}
      <Section title="Follow Up Boss" description="Send new leads to your brokerage's Follow Up Boss account.">
        {fub.connected ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-gray-700">
              Connected{fub.last4 ? (
                <>
                  {' '}· key ending <span className="font-mono">{fub.last4}</span>
                </>
              ) : null}
            </p>
            <button type="button" onClick={disconnectFub} disabled={fubBusy} className={secondaryClass}>
              {fubBusy ? 'Working…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <form onSubmit={connectFub} className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1">
              <span className="sr-only">Follow Up Boss API key</span>
              <input
                type="password"
                autoComplete="off"
                value={fubKey}
                onChange={(e) => setFubKey(e.target.value)}
                placeholder="Paste your Follow Up Boss API key"
                className={inputClass.replace('mt-1 ', '')}
              />
            </label>
            <button type="submit" disabled={fubBusy || !fubKey.trim()} className={primaryClass} style={{ backgroundColor: GOLD }}>
              {fubBusy ? 'Connecting…' : 'Connect'}
            </button>
          </form>
        )}
        <Note kind={fubNote?.kind}>{fubNote?.text}</Note>
      </Section>

      {/* Test email */}
      <Section title="Test email" description="See exactly what your buyers get: a sample email with your brand, sent to you.">
        <button type="button" onClick={sendTest} disabled={testBusy} className={secondaryClass}>
          {testBusy ? 'Sending…' : 'Send me a test email'}
        </button>
        <Note kind={testNote?.kind}>{testNote?.text}</Note>
      </Section>
    </div>
  );
}
