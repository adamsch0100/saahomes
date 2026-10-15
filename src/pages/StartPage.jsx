/**
 * /start — a brokerage signs itself up: its own branded home search site,
 * alerts and assistant, working with Follow Up Boss. Platform site only; a
 * brokerage's own domain shows "not found".
 *
 * The new owner lands in their console signed in, with setup steps waiting.
 * The page wears the platform's identity (utils/platform.js), never SAA's.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSignupInfo, checkSignupSlug, submitSignup } from '../utils/plugAndPlayApi.js';
import { useIsBrokerage } from '../context/TenantContext.jsx';
import PlanPicker, { fmtMoney, perInterval } from '../components/billing/PlanPicker.jsx';
import { usePlatform, isPlatformSite } from '../utils/platform.js';

const OFFER = [
  { title: 'Your own branded search site', text: 'Every home for sale in your market, under your name, logo and colors, on your domain.' },
  { title: 'Alerts buyers actually open', text: 'Saved searches and instant new-listing emails, sent in your brand.' },
  { title: 'Nadia, your AI assistant', text: 'Answers buyers’ questions about homes and neighborhoods any time of day, then hands them to your team.' },
  { title: 'Works with Follow Up Boss', text: 'Leads, searches and home views flow into the CRM your agents already use.' },
];

const FIELDS = [
  { key: 'brokerage_name', label: 'Brokerage name', autoComplete: 'organization', placeholder: 'Peak Realty' },
  { key: 'name', label: 'Your name', autoComplete: 'name', placeholder: 'Jordan Lee' },
  { key: 'email', label: 'Work email', type: 'email', autoComplete: 'email', placeholder: 'jordan@peakrealty.com' },
  { key: 'phone', label: 'Phone', type: 'tel', autoComplete: 'tel', placeholder: '(555) 555-0100' },
  { key: 'city', label: 'Main city or market', autoComplete: 'address-level2', placeholder: 'Austin, TX' },
  { key: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', placeholder: 'At least 8 characters' },
];

const inputClass =
  'mt-1 w-full min-h-[48px] border border-gray-300 rounded-lg px-3 text-base sm:text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900';

function slugify(name) {
  return String(name || '').toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(llc|inc|ltd|co)\b\.?/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

function priceText(price) {
  if (!price) return 'Pricing on request';
  const amount = price.amount.toLocaleString('en-US', {
    style: 'currency',
    currency: price.currency || 'USD',
    maximumFractionDigits: price.amount % 1 ? 2 : 0,
  });
  return `${amount} per agent a ${price.interval || 'month'}`;
}

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <a href="/" className="mt-4 inline-block underline text-gray-700">Go to the home page</a>
      </div>
    </main>
  );
}

export default function StartPage() {
  const isBrokerage = useIsBrokerage();
  const [info, setInfo] = useState(null);
  const [form, setForm] = useState({ brokerage_name: '', name: '', email: '', phone: '', city: '', password: '', website: '' });
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState(null); // { available, reason, host }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [fieldError, setFieldError] = useState(null);
  // The marketing page's "Start free trial" links name a plan: /start?plan=brokerage
  const [choice, setChoice] = useState(() => {
    const asked = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('plan') : null;
    return { plan: /^[a-z]{2,20}$/.test(asked || '') ? asked : 'team', interval: 'month' };
  });
  const startedAt = useRef(Date.now());
  const platform = usePlatform(!isBrokerage);

  useEffect(() => {
    if (isBrokerage) return;
    let cancelled = false;
    getSignupInfo()
      .then((res) => {
        if (cancelled) return;
        setInfo(res);
      })
      .catch(() => !cancelled && setInfo({ product_name: null, trial_days: 14, price: null, base_domain: null }));
    return () => { cancelled = true; };
  }, [isBrokerage]);

  const effectiveSlug = slugEdited ? slug : slugify(form.brokerage_name);
  const baseDomain = info?.base_domain || null;

  useEffect(() => {
    if (!baseDomain || !effectiveSlug) {
      setSlugState(null);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      checkSignupSlug(effectiveSlug)
        .then((res) => !cancelled && setSlugState(res))
        .catch(() => !cancelled && setSlugState(null));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [effectiveSlug, baseDomain]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (fieldError === k) {
      setFieldError(null);
      setError(null);
    }
  };

  const productName = platform?.name || info?.product_name || '';
  const trialDays = info?.trial_days || 14;
  const price = useMemo(() => priceText(info?.price), [info]);
  // The plans, unless the platform still sells its older single per-agent price.
  const plans = !info?.price && info?.plans?.length ? info : null;
  const chosen = plans?.plans.find((p) => p.key === choice.plan) || plans?.plans[0] || null;

  useEffect(() => {
    if (productName && !isBrokerage && typeof document !== 'undefined') document.title = `${productName} — Get started`;
  }, [productName, isBrokerage]);

  if (isBrokerage) return <NotFound />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      const body = {
        ...form,
        elapsed_ms: Date.now() - startedAt.current,
      };
      if (chosen) {
        body.plan = chosen.key;
        body.interval = choice.interval;
      }
      if (baseDomain && slugEdited && slug) body.slug = slug;
      const res = await submitSignup(body);
      const data = res?.data || {};
      let dest = data.console_url || '/admin';
      try {
        const u = new URL(dest, window.location.href);
        dest = u.origin === window.location.origin ? `${u.pathname}${u.search}` : u.toString();
      } catch {
        /* keep as is */
      }
      window.location.assign(`${dest}#t=${encodeURIComponent(data.token || '')}`);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setFieldError(err.field || null);
      if (err.field === 'slug') setSlugEdited(true);
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {isPlatformSite() ? (
            <a href="/" className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight min-h-[44px]">
              {platform?.logo_url ? <img src={platform.logo_url} alt="" className="h-8 w-auto" /> : null}
              <span>{productName}</span>
            </a>
          ) : (
            <span className="flex items-center gap-2 font-bold text-base sm:text-lg tracking-tight">
              {platform?.logo_url ? <img src={platform.logo_url} alt="" className="h-8 w-auto" /> : null}
              <span>{productName}</span>
            </span>
          )}
          <a href="/admin" className="text-sm font-medium text-gray-600 hover:text-black min-h-[44px] inline-flex items-center px-2">Sign in</a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-14 grid lg:grid-cols-[1fr_440px] gap-10 lg:gap-14 items-start">
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">For real estate brokerages</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Your own home search site. Live in an afternoon.
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 max-w-xl">
            A search site in your brand that buyers come back to, alerts they open, and an assistant that answers them, all feeding the
            Follow Up Boss account your agents already use.
          </p>
          <ul className="mt-8 grid sm:grid-cols-2 gap-4">
            {OFFER.map((o) => (
              <li key={o.title} className="rounded-xl bg-white border border-gray-200 p-4">
                <p className="font-semibold">{o.title}</p>
                <p className="text-sm text-gray-600 mt-1">{o.text}</p>
              </li>
            ))}
          </ul>
          {plans ? (
            <section className="mt-8" aria-labelledby="pricing-title">
              <h2 id="pricing-title" className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pricing</h2>
              <p className="text-sm text-gray-600 mt-1 mb-3">
                {trialDays}-day free trial on any plan. No card to start, no setup fee. You can change plans any time.
              </p>
              <PlanPicker catalog={plans} value={{ plan: chosen?.key, interval: choice.interval }} onChange={setChoice} name="signup-plan" />
              {plans.features?.length > 0 && (
                <p className="text-xs text-gray-500 mt-3">Every plan: {plans.features.join(' · ')}.</p>
              )}
            </section>
          ) : (
            <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pricing</p>
                <p className="text-lg font-bold mt-0.5 whitespace-nowrap">{price}</p>
              </div>
              <p className="text-sm text-gray-600">
                {trialDays}-day free trial. No card to start. Sample homes show until your MLS approves your feed.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-white border border-gray-200 shadow-sm p-5 sm:p-7" aria-labelledby="start-title">
          <h2 id="start-title" className="text-xl font-bold">Start your free trial</h2>
          <p className="text-sm text-gray-600 mt-1">Takes about a minute. You’ll set up your brand next.</p>
          <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-sm font-medium text-gray-800">{f.label}</span>
                <input
                  name={f.key}
                  type={f.type || 'text'}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={set(f.key)}
                  required
                  minLength={f.key === 'password' ? 8 : undefined}
                  aria-invalid={fieldError === f.key || undefined}
                  className={`${inputClass} ${fieldError === f.key ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                />
              </label>
            ))}

            {baseDomain && effectiveSlug && (
              <div>
                <label className="block">
                  <span className="text-sm font-medium text-gray-800">Your free web address</span>
                  <div className={`mt-1 flex items-stretch rounded-lg border ${fieldError === 'slug' ? 'border-red-500' : 'border-gray-300'} overflow-hidden focus-within:ring-2 focus-within:ring-gray-900`}>
                    <input
                      name="slug"
                      value={effectiveSlug}
                      onChange={(e) => {
                        setSlugEdited(true);
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40));
                        if (fieldError === 'slug') {
                          setFieldError(null);
                          setError(null);
                        }
                      }}
                      className="min-w-0 flex-1 min-h-[48px] px-3 text-base sm:text-sm focus:outline-none"
                    />
                    <span className="flex items-center px-3 bg-gray-50 text-sm text-gray-500 border-l border-gray-300 whitespace-nowrap">.{baseDomain}</span>
                  </div>
                </label>
                <p className={`text-xs mt-1 ${slugState && !slugState.available ? 'text-red-700' : 'text-gray-500'}`}>
                  {slugState && !slugState.available ? slugState.reason : 'You can connect your own domain later.'}
                </p>
              </div>
            )}

            {/* Leave empty: people never see this field. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>
                Website
                <input name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </label>
            </div>

            {error && (
              <div role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">{error}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full min-h-[52px] rounded-lg bg-gray-900 text-white font-semibold hover:bg-black disabled:opacity-60"
            >
              {busy ? 'Creating your site…' : 'Create my site'}
            </button>
            {chosen && (
              <p className="text-xs text-gray-600 text-center">
                {chosen.name} plan: {fmtMoney(chosen[choice.interval].base_cents, plans.currency)} {perInterval(choice.interval)} after your {trialDays}-day free trial.
              </p>
            )}
            <p className="text-xs text-gray-500 text-center">
              We’ll email you a link to confirm your address.
              {platform?.support_email ? (
                <>
                  {' '}Questions?{' '}
                  <a href={`mailto:${platform.support_email}`} className="underline">{platform.support_email}</a>
                </>
              ) : null}
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
