/**
 * Embeds (brokerage owner): home search widgets for any other website the
 * brokerage runs (WordPress, Squarespace, Wix, ...). Pick a widget, see it live,
 * copy the snippet. Widgets come from the brokerage's own site address and
 * open listings there in a new tab.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getOwnerEmbeds } from '../../utils/plugAndPlayApi.js';
import { consoleBrokerage } from '../../utils/consoleBrokerage.js';

const WIDGETS = [
  { key: 'search', label: 'Search box', help: 'A search bar that opens results on your site.' },
  { key: 'listings', label: 'Listings grid', help: 'Homes for sale, filtered by city, price, beds and type.' },
  { key: 'listing', label: 'Featured home', help: 'One home, big photo and the details.' },
];

const TYPES = [
  { value: '', label: 'Any type' },
  { value: 'house', label: 'Houses' },
  { value: 'condo', label: 'Condos' },
  { value: 'townhouse', label: 'Townhomes' },
  { value: 'land', label: 'Land' },
];

const inputClass =
  'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';

function slugFrom(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const m = /\/homes-for-sale\/([A-Za-z0-9-]+)/.exec(v);
  const slug = m ? m[1] : v;
  return /^[A-Za-z0-9-]{1,160}$/.test(slug) ? slug : '';
}

function CopyField({ label, value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button type="button" onClick={copy} className="min-h-[36px] px-3 rounded-md border border-gray-300 text-xs font-medium text-gray-700 hover:border-black">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="mt-1.5 text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{value}</pre>
    </div>
  );
}

export default function EmbedsCard({ token }) {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [widget, setWidget] = useState('search');
  const [opts, setOpts] = useState({ city: '', minPrice: '', maxPrice: '', beds: '', type: '', count: '6', listing: '' });
  const [height, setHeight] = useState(null);
  const frameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getOwnerEmbeds(token)
      .then((res) => {
        if (cancelled) return;
        setInfo(res.data);
      })
      .catch((err) => !cancelled && setError(err.message || 'Could not load embeds'));
    return () => { cancelled = true; };
  }, [token]);

  const base = info?.base_url || null;
  // On the brokerage's own site the preview loads from here; on the platform's
  // site (a console with no address yet) it needs the brokerage's address.
  const previewBase = typeof window !== 'undefined' && !consoleBrokerage() ? window.location.origin : base;

  const attrs = useMemo(() => {
    const a = [];
    if (widget === 'listing') {
      const slug = slugFrom(opts.listing);
      if (slug) a.push(['listing', slug]);
      return a;
    }
    if (opts.city.trim()) a.push(['city', opts.city.trim()]);
    if (widget === 'listings') {
      if (Number(opts.minPrice) > 0) a.push(['min-price', String(Math.round(Number(opts.minPrice)))]);
      if (Number(opts.maxPrice) > 0) a.push(['max-price', String(Math.round(Number(opts.maxPrice)))]);
      if (Number(opts.beds) > 0) a.push(['beds', String(Math.round(Number(opts.beds)))]);
      if (opts.type) a.push(['type', opts.type]);
      if (opts.count && opts.count !== '6') a.push(['count', opts.count]);
    } else {
      if (Number(opts.beds) > 0) a.push(['beds', String(Math.round(Number(opts.beds)))]);
    }
    return a;
  }, [widget, opts]);

  const query = useMemo(() => {
    const map = { 'min-price': 'minPrice', 'max-price': 'maxPrice' };
    const p = attrs.map(([k, v]) => `${map[k] || k}=${encodeURIComponent(v)}`);
    return p.length ? `?${p.join('&')}` : '';
  }, [attrs]);

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const divSnippet = base
    ? `<div data-home-embed="${widget}"${attrs.map(([k, v]) => ` data-${k}="${esc(v)}"`).join('')}></div>\n<script src="${base}/embed.js" async></script>`
    : '';
  const iframeSnippet = base
    ? `<iframe src="${base}/embed/${widget}${query}" title="Homes for sale" style="width:100%;border:0;min-height:${widget === 'search' ? 150 : 520}px" loading="lazy"></iframe>`
    : '';
  const previewSrc = previewBase ? `${previewBase}/embed/${widget}${query}` : null;
  const needsListing = widget === 'listing' && !slugFrom(opts.listing);

  useEffect(() => {
    setHeight(null);
    if (!previewSrc) return undefined;
    let origin;
    try {
      origin = new URL(previewSrc).origin;
    } catch {
      return undefined;
    }
    const onMessage = (e) => {
      if (e.origin !== origin || e.source !== frameRef.current?.contentWindow) return;
      if (e.data?.type === 'saa-embed:height') setHeight(Math.max(60, Math.ceil(Number(e.data.height) || 0)));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [previewSrc]);

  const set = (k) => (e) => setOpts((o) => ({ ...o, [k]: e.target.value }));
  const views = info?.views_30d || {};
  const totalViews = (views.search || 0) + (views.listings || 0) + (views.listing || 0);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" aria-labelledby="embeds-title">
      <h2 id="embeds-title" className="text-lg font-bold text-gray-900">Embeds</h2>
      <p className="text-sm text-gray-500 mt-1">
        Put your home search on any other website you run. Homes open on your site in a new tab, so leads come to you.
      </p>

      {error && <div className="mt-4 border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">{error}</div>}
      {!info && !error && <div className="mt-4 h-40 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />}

      {info && !base && (
        <p className="mt-4 text-sm text-gray-600 rounded-lg border border-dashed border-gray-300 px-3 py-2.5">
          Widgets need your site’s address. Connect your domain in Website domain above, then come back here for your snippets.
        </p>
      )}

      {info && base && (
        <div className="mt-4 space-y-4">
          <div role="tablist" aria-label="Widget" className="flex flex-wrap gap-2">
            {WIDGETS.map((w) => (
              <button
                key={w.key}
                type="button"
                role="tab"
                aria-selected={widget === w.key}
                onClick={() => setWidget(w.key)}
                className={`min-h-[44px] px-4 rounded-lg text-sm font-semibold transition-colors ${widget === w.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
              >
                {w.label}
                {views[w.key] ? <span className={`ml-1.5 text-xs font-normal ${widget === w.key ? 'text-gray-300' : 'text-gray-400'}`}>{views[w.key]}</span> : null}
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-600">{WIDGETS.find((w) => w.key === widget).help}</p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {widget === 'listing' ? (
              <label className="block col-span-2 sm:col-span-3">
                <span className="text-xs font-semibold text-gray-700">Home link or listing ID</span>
                <input value={opts.listing} onChange={set('listing')} placeholder={`${base}/homes-for-sale/...`} className={inputClass} />
              </label>
            ) : (
              <>
                <label className="block col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-gray-700">City</span>
                  <input value={opts.city} onChange={set('city')} placeholder="Any city" className={inputClass} />
                </label>
                {widget === 'listings' && (
                  <>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Min price</span>
                      <input inputMode="numeric" value={opts.minPrice} onChange={set('minPrice')} placeholder="No min" className={inputClass} />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Max price</span>
                      <input inputMode="numeric" value={opts.maxPrice} onChange={set('maxPrice')} placeholder="No max" className={inputClass} />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className="text-xs font-semibold text-gray-700">Beds</span>
                  <select value={opts.beds} onChange={set('beds')} className={inputClass}>
                    <option value="">Any</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}
                  </select>
                </label>
                {widget === 'listings' && (
                  <>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">Type</span>
                      <select value={opts.type} onChange={set('type')} className={inputClass}>
                        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold text-gray-700">How many</span>
                      <select value={opts.count} onChange={set('count')} className={inputClass}>
                        {[3, 4, 6, 8, 9, 12].map((n) => <option key={n} value={String(n)}>{n}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-700">Live preview</p>
            <div className="mt-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3">
              {needsListing ? (
                <p className="text-sm text-gray-500 py-6 text-center">Paste a home’s link from your site to preview it.</p>
              ) : previewSrc ? (
                <iframe
                  key={previewSrc}
                  ref={frameRef}
                  src={previewSrc}
                  title="Widget preview"
                  className="block w-full border-0 bg-transparent"
                  style={{ height: height ? `${height}px` : widget === 'search' ? 150 : 420 }}
                />
              ) : null}
            </div>
          </div>

          {!needsListing && (
            <div className="space-y-3">
              <CopyField label="Paste this where the widget should go" value={divSnippet} />
              <details className="text-sm text-gray-600">
                <summary className="cursor-pointer min-h-[44px] flex items-center font-medium text-gray-700">Site doesn’t allow scripts? Use an iframe</summary>
                <div className="mt-2">
                  <CopyField label="Iframe (fixed height)" value={iframeSnippet} />
                </div>
              </details>
              <ul className="text-xs text-gray-500 space-y-1">
                <li><span className="font-semibold text-gray-700">WordPress:</span> add a Custom HTML block and paste.</li>
                <li><span className="font-semibold text-gray-700">Squarespace:</span> add a Code block and paste.</li>
                <li><span className="font-semibold text-gray-700">Wix:</span> Add, then Embed Code, then Embed HTML, and paste.</li>
              </ul>
            </div>
          )}

          <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
            {totalViews
              ? `Your widgets were seen ${totalViews.toLocaleString('en-US')} time${totalViews === 1 ? '' : 's'} in the last 30 days.`
              : 'Once your widgets are live, you’ll see how often they’re seen here.'}
          </p>
        </div>
      )}
    </section>
  );
}
