/**
 * Platform console — plans and Stripe: is Stripe set up (key, test or live,
 * plan prices synced, webhook ready), total monthly revenue, and the plan
 * prices themselves, editable. Saving new prices syncs them to Stripe: new
 * checkouts and plan switches use them, existing subscribers keep theirs.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getPlatformBilling, savePlatformPlans, syncPlatformBilling } from '../../utils/plugAndPlayApi.js';
import { fmtMoney } from '../billing/PlanPicker.jsx';

const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);

function Check({ ok, label, detail }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-800'}`}
      >
        {ok ? '✓' : '!'}
      </span>
      <span>
        <span className="font-medium text-gray-900">{label}</span>
        {detail && <span className="block text-xs text-gray-500 break-all">{detail}</span>}
      </span>
    </li>
  );
}

const toForm = (catalog) => ({
  yearly_months: String(catalog?.yearly_months ?? 10),
  plans: Object.fromEntries((catalog?.editable || []).map((p) => [p.key, {
    name: p.name, monthly: String(p.monthly), included: String(p.included), extra: String(p.extra),
  }])),
});

export default function PlatformBillingPanel({ token }) {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const apply = (d) => {
    setData(d);
    setForm(toForm(d?.catalog));
  };

  const load = useCallback(async () => {
    try {
      const res = await getPlatformBilling(token);
      apply(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not load billing');
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setBusy('sync');
    setError(null);
    setNotice(null);
    try {
      const res = await syncPlatformBilling(token);
      apply(res.data);
      const changed = (res.sync?.plans?.prices || []).filter((p) => p.action !== 'reused').length;
      setNotice(res.sync?.plans?.error
        ? `Plans didn’t sync: ${res.sync.plans.error}`
        : `Synced. ${changed ? `${changed} price${changed === 1 ? '' : 's'} added in Stripe.` : 'Stripe already matched.'}`);
    } catch (err) {
      setError(err.message || 'Could not sync with Stripe');
    } finally {
      setBusy(null);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      const res = await savePlatformPlans(token, form);
      apply(res.data);
      setNotice(res.sync?.error
        ? `Saved, but Stripe didn’t sync: ${res.sync.error}`
        : res.sync?.skipped === 'no_key' ? 'Saved. They’ll go to Stripe once a key is added.' : 'Saved and synced to Stripe.');
    } catch (err) {
      setError(err.message || 'Could not save the plans');
    } finally {
      setBusy(null);
    }
  };

  const setPlan = (key, field) => (e) => setForm((f) => ({ ...f, plans: { ...f.plans, [key]: { ...f.plans[key], [field]: e.target.value } } }));

  const s = data?.stripe;
  const totals = data?.totals;
  const inputClass = 'w-full min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm';

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5" aria-labelledby="platform-billing-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="platform-billing-title" className="text-lg font-bold text-gray-900">Plans and billing</h2>
          <p className="text-sm text-gray-500 mt-1">Stripe sets itself up from the secret key. Prices here are what new brokerages pay.</p>
        </div>
        {s?.key_present && (
          <button
            type="button"
            onClick={sync}
            disabled={!!busy}
            className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
          >
            {busy === 'sync' ? 'Syncing…' : 'Sync plans to Stripe'}
          </button>
        )}
      </div>

      {!data && !error && <div className="h-24 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />}

      {data && (
        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Stripe</h3>
            <ul className="mt-2 space-y-2">
              <Check
                ok={s.key_present}
                label={s.key_present ? `Secret key added (${s.mode === 'live' ? 'live' : 'test'} mode)` : 'No secret key yet'}
                detail={s.key_present ? (s.mode === 'test' ? 'Test mode: no real charges.' : 'Live mode: real charges.') : 'Add STRIPE_SECRET_KEY to the server’s settings.'}
              />
              {s.key_present && (
                <Check
                  ok={s.plans.synced}
                  label={s.plans.synced ? 'Plans are in Stripe' : 'Plans aren’t synced'}
                  detail={s.plans.error || (s.plans.synced
                    ? (s.plans.synced_at ? `Last synced ${fmtWhen(s.plans.synced_at)}` : null)
                    : `${s.plans.missing.length + s.plans.outdated.length} price${s.plans.missing.length + s.plans.outdated.length === 1 ? '' : 's'} to add. Press Sync.`)}
                />
              )}
              {s.key_present && (
                <Check
                  ok={s.webhook.ready}
                  label={s.webhook.ready ? 'Webhook ready' : 'Webhook not set up'}
                  detail={s.webhook.ready
                    ? (s.webhook.source === 'env' ? 'Using STRIPE_WEBHOOK_SECRET.' : `Set up automatically: ${s.webhook.url}`)
                    : s.webhook.note}
                />
              )}
              {s.legacy_price && (
                <li className="text-xs text-gray-500">STRIPE_PRICE_BROKERAGE_SEAT is set; it’s only used if the plan prices can’t be.</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Monthly revenue</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{fmtMoney(totals.mrr_cents)}</p>
            <p className="text-sm text-gray-600">
              {totals.paying} paying brokerage{totals.paying === 1 ? '' : 's'}. Yearly plans count as a twelfth a month.
            </p>
            {totals.trialing > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {totals.trialing} in a free trial, worth {fmtMoney(totals.trial_mrr_cents)} a month if they all pay.
              </p>
            )}
          </div>
        </div>
      )}

      {form && data?.catalog && (
        <form onSubmit={save} className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Prices</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-1 pr-3 font-medium">Plan</th>
                  <th className="py-1 pr-3 font-medium">Per month ($)</th>
                  <th className="py-1 pr-3 font-medium">Agents included</th>
                  <th className="py-1 pr-3 font-medium">Per extra agent ($)</th>
                </tr>
              </thead>
              <tbody>
                {data.catalog.editable.map((p) => (
                  <tr key={p.key}>
                    <td className="py-1 pr-3 min-w-[140px]">
                      <input aria-label={`${p.key} name`} value={form.plans[p.key].name} onChange={setPlan(p.key, 'name')} className={inputClass} />
                    </td>
                    <td className="py-1 pr-3 min-w-[110px]">
                      <input aria-label={`${p.name} price per month`} inputMode="decimal" value={form.plans[p.key].monthly} onChange={setPlan(p.key, 'monthly')} className={inputClass} />
                    </td>
                    <td className="py-1 pr-3 min-w-[110px]">
                      <input aria-label={`${p.name} agents included`} inputMode="numeric" value={form.plans[p.key].included} onChange={setPlan(p.key, 'included')} className={inputClass} />
                    </td>
                    <td className="py-1 pr-3 min-w-[110px]">
                      <input aria-label={`${p.name} price per extra agent`} inputMode="decimal" value={form.plans[p.key].extra} onChange={setPlan(p.key, 'extra')} className={inputClass} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            Yearly plans cost
            <input
              aria-label="Months charged for a year"
              inputMode="numeric"
              value={form.yearly_months}
              onChange={(e) => setForm((f) => ({ ...f, yearly_months: e.target.value }))}
              className="w-16 min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm"
            />
            months of the monthly price.
          </label>
          <p className="text-xs text-gray-500">
            Brokerages already subscribed keep the price they signed up at. New checkouts and plan switches use the new one.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!!busy}
              className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
            >
              {busy === 'save' ? 'Saving…' : 'Save prices'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => setForm(toForm({ yearly_months: data.catalog.defaults.yearly_months, editable: data.catalog.defaults.plans }))}
              className="min-h-[44px] px-4 text-sm text-gray-600 hover:text-black disabled:opacity-50"
            >
              Use the default prices
            </button>
          </div>
        </form>
      )}

      {notice && <p className="text-sm text-green-800" role="status">{notice}</p>}
      {error && (
        <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">
          {error}
          {!data && <button type="button" onClick={load} className="ml-3 underline">Try again</button>}
        </div>
      )}
    </section>
  );
}
