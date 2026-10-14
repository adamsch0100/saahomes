/**
 * Billing (brokerage owner): plan, seats, free-trial days left, and Stripe's
 * pages to subscribe ("Add payment method") and to manage cards and invoices.
 * Shows "Billing isn't set up yet" when the platform has no Stripe keys.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getOwnerBilling, startBillingCheckout, openBillingPortal } from '../../utils/plugAndPlayApi.js';

const STATUS = {
  trialing: { label: 'Free trial', cls: 'bg-blue-50 text-blue-700' },
  active: { label: 'Active', cls: 'bg-green-50 text-green-700' },
  grace: { label: 'Trial ended', cls: 'bg-amber-50 text-amber-800' },
  past_due: { label: 'Payment due', cls: 'bg-amber-50 text-amber-800' },
  canceled: { label: 'Canceled', cls: 'bg-gray-100 text-gray-600' },
  none: { label: 'Not subscribed', cls: 'bg-gray-100 text-gray-600' },
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null);

function priceLine(price) {
  if (!price) return 'Pricing on request';
  const amount = price.amount.toLocaleString('en-US', { style: 'currency', currency: price.currency || 'USD', maximumFractionDigits: price.amount % 1 ? 2 : 0 });
  return `${amount} per agent a ${price.interval || 'month'}`;
}

export default function BillingCard({ token, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const returned = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('billing') : null;

  const load = useCallback(async () => {
    try {
      const res = await getOwnerBilling(token);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not load billing');
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const go = async (which) => {
    setBusy(which);
    setError(null);
    try {
      const res = which === 'portal' ? await openBillingPortal(token) : await startBillingCheckout(token);
      if (res?.url) window.location.assign(res.url);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setBusy(null);
    }
  };

  if (data?.exempt) return null;

  const status = data?.suspended ? { label: 'Paused', cls: 'bg-red-50 text-red-700' } : STATUS[data?.status] || STATUS.none;
  const seats = data?.seats ?? 1;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" aria-labelledby="billing-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="billing-title" className="text-lg font-bold text-gray-900">Billing</h2>
          {!compact && <p className="text-sm text-gray-500 mt-1">One simple plan: you pay for each active person on your team.</p>}
        </div>
        {data && (
          <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded ${status.cls}`}>{status.label}</span>
        )}
      </div>

      {!data && !error && <div className="mt-4 h-24 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />}

      {data && (
        <div className="mt-4 space-y-4">
          {returned === 'success' && (
            <div className="border border-green-200 bg-green-50 text-green-800 rounded-lg px-3 py-2 text-sm">
              Thanks! Your payment method is saved. It can take a minute for this page to catch up.
            </div>
          )}
          {data.banner && (
            <div className={`border rounded-lg px-3 py-2 text-sm ${data.banner.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : data.banner.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}>
              {data.banner.text}
            </div>
          )}

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs text-gray-500">Plan</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">{priceLine(data.price)}</dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs text-gray-500">Seats</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {seats} {seats === 1 ? 'person' : 'people'}
                <span className="block text-xs font-normal text-gray-500">you and active agents</span>
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 col-span-2 sm:col-span-1">
              <dt className="text-xs text-gray-500">
                {data.status === 'trialing' && !data.has_subscription ? 'Free trial' : data.grace_ends_at ? 'Keep your site live by' : 'Next bill'}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {data.status === 'trialing' && !data.has_subscription
                  ? `${data.trial_days_left} day${data.trial_days_left === 1 ? '' : 's'} left`
                  : data.grace_ends_at
                    ? fmtDate(data.grace_ends_at)
                    : fmtDate(data.current_period_end) || '—'}
                {data.status === 'trialing' && data.trial_ends_at && (
                  <span className="block text-xs font-normal text-gray-500">ends {fmtDate(data.trial_ends_at)}</span>
                )}
              </dd>
            </div>
          </dl>

          {!data.configured ? (
            <p className="text-sm text-gray-600 rounded-lg border border-dashed border-gray-300 px-3 py-2.5">
              Billing isn’t set up yet. Keep using everything; we’ll let you know before anything changes.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {!data.has_subscription && (
                <button
                  type="button"
                  onClick={() => go('checkout')}
                  disabled={!!busy}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
                >
                  {busy === 'checkout' ? 'Opening…' : data.status === 'trialing' ? 'Add payment method' : 'Subscribe'}
                </button>
              )}
              {data.has_customer && (
                <button
                  type="button"
                  onClick={() => go('portal')}
                  disabled={!!busy}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
                >
                  {busy === 'portal' ? 'Opening…' : 'Manage billing'}
                </button>
              )}
            </div>
          )}
          {data.configured && !data.has_subscription && data.status === 'trialing' && (
            <p className="text-xs text-gray-500">
              You won’t be charged until your free trial ends{data.trial_ends_at ? ` on ${fmtDate(data.trial_ends_at)}` : ''}. Seats update on their own as you add or remove agents.
            </p>
          )}
        </div>
      )}
      {error && (
        <div className="mt-3 border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">
          {error}
          {!data && (
            <button type="button" onClick={load} className="ml-3 underline">Try again</button>
          )}
        </div>
      )}
    </section>
  );
}
