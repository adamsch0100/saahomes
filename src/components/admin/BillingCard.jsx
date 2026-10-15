/**
 * Billing (brokerage owner): the plan, monthly or yearly, seats against what
 * the plan includes, the estimated next bill, free-trial days left, a nudge
 * when another plan would cost less, and Stripe's pages to subscribe ("Add
 * payment method") and to manage cards and invoices. Picking a plan works
 * before Stripe is set up (it's remembered); once subscribed, switching moves
 * the subscription to the new plan with proration.
 * Shows "Billing isn't set up yet" when the platform has no Stripe keys.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  getOwnerBilling, startBillingCheckout, openBillingPortal, chooseBillingPlan,
} from '../../utils/plugAndPlayApi.js';
import PlanPicker, { fmtMoney, perInterval } from '../billing/PlanPicker.jsx';

const STATUS = {
  trialing: { label: 'Free trial', cls: 'bg-blue-50 text-blue-700' },
  active: { label: 'Active', cls: 'bg-green-50 text-green-700' },
  grace: { label: 'Trial ended', cls: 'bg-amber-50 text-amber-800' },
  past_due: { label: 'Payment due', cls: 'bg-amber-50 text-amber-800' },
  canceled: { label: 'Canceled', cls: 'bg-gray-100 text-gray-600' },
  none: { label: 'Not subscribed', cls: 'bg-gray-100 text-gray-600' },
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null);

function legacyLine(price) {
  if (!price) return 'Pricing on request';
  return `${fmtMoney(price.amount * 100, price.currency)} per agent ${perInterval(price.interval)}`;
}

function planLine(plan) {
  if (!plan) return 'Pricing on request';
  if (plan.legacy) return `${fmtMoney(plan.unit_cents, plan.currency)} per agent ${perInterval(plan.interval)}`;
  return `${plan.name}, ${plan.interval === 'year' ? 'yearly' : 'monthly'}`;
}

export default function BillingCard({ token, compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [choice, setChoice] = useState(null);
  const [picking, setPicking] = useState(false);
  const returned = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('billing') : null;

  const apply = useCallback((d) => {
    setData(d);
    if (d?.plan && !d.plan.legacy) setChoice({ plan: d.plan.key, interval: d.plan.interval });
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await getOwnerBilling(token);
      apply(res.data);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not load billing');
    }
  }, [token, apply]);

  useEffect(() => { load(); }, [load]);

  const go = async (which) => {
    setBusy(which);
    setError(null);
    try {
      const res = which === 'portal' ? await openBillingPortal(token) : await startBillingCheckout(token, choice || {});
      if (res?.url) window.location.assign(res.url);
    } catch (err) {
      setError(err.message || 'Something went wrong');
      setBusy(null);
    }
  };

  const savePlan = async (next) => {
    const target = next || choice;
    if (!target) return;
    if (data?.has_subscription) {
      const name = data.catalog?.plans?.find((p) => p.key === target.plan)?.name || target.plan;
      const ok = window.confirm(`Switch to ${name}, billed ${target.interval === 'year' ? 'yearly' : 'monthly'}? Stripe credits what's left of this period and charges the difference.`);
      if (!ok) return;
    }
    setBusy('plan');
    setError(null);
    setNotice(null);
    try {
      const res = await chooseBillingPlan(token, target);
      apply(res.data);
      setPicking(false);
      setNotice(res.switched ? 'Your plan is switched.' : res.unchanged ? 'You’re already on that plan.' : 'Plan saved. It’s what you’ll pay once you subscribe.');
    } catch (err) {
      setError(err.message || 'Couldn’t change your plan');
    } finally {
      setBusy(null);
    }
  };

  if (data?.exempt) return null;

  const status = data?.suspended ? { label: 'Paused', cls: 'bg-red-50 text-red-700' } : STATUS[data?.status] || STATUS.none;
  const seats = data?.seats ?? 1;
  const plan = data?.plan;
  const legacy = data?.billing_mode === 'legacy' || plan?.legacy;
  const estimate = data?.estimate;
  const trialNoSub = data?.status === 'trialing' && !data?.has_subscription;
  const canPick = !!data?.catalog && !legacy && (!data?.has_subscription || data?.can_switch);
  const showPicker = canPick && (picking || (!data?.has_subscription && !plan?.chosen));
  const choiceChanged = choice && plan && (choice.plan !== plan.key || choice.interval !== plan.interval);
  const suggestionName = data?.suggestion?.name;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" aria-labelledby="billing-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="billing-title" className="text-lg font-bold text-gray-900">Billing</h2>
          {!compact && (
            <p className="text-sm text-gray-500 mt-1">
              {legacy ? 'One simple plan: you pay for each active person on your team.' : 'Each plan includes a number of agents; past that you pay a little for each extra one.'}
            </p>
          )}
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

          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5 col-span-2 sm:col-span-1">
              <dt className="text-xs text-gray-500">Plan</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {legacy && !plan?.legacy ? legacyLine(data.price) : plan?.chosen === false ? 'Not picked yet' : planLine(plan)}
                {plan && !plan.legacy && plan.included != null && (
                  <span className="block text-xs font-normal text-gray-500">
                    {plan.included} agents included, then {fmtMoney(plan.extra_cents, plan.currency)} each
                  </span>
                )}
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs text-gray-500">Seats</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {seats} {seats === 1 ? 'person' : 'people'}
                <span className="block text-xs font-normal text-gray-500">
                  {plan?.included != null && !plan.legacy ? `of ${plan.included} included` : 'you and active agents'}
                </span>
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs text-gray-500">{data.grace_ends_at ? 'Keep your site live by' : 'Next bill (estimate)'}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {data.grace_ends_at
                  ? fmtDate(data.grace_ends_at)
                  : estimate?.amount_cents != null
                    ? `${fmtMoney(estimate.amount_cents, estimate.currency)} ${perInterval(estimate.interval)}`
                    : '—'}
                {!data.grace_ends_at && estimate?.due_at && (
                  <span className="block text-xs font-normal text-gray-500">{trialNoSub ? 'after your trial, on' : 'on'} {fmtDate(estimate.due_at)}</span>
                )}
              </dd>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <dt className="text-xs text-gray-500">{data.status === 'trialing' ? 'Free trial' : 'Renews'}</dt>
              <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                {data.status === 'trialing' && data.trial_days_left != null
                  ? `${data.trial_days_left} day${data.trial_days_left === 1 ? '' : 's'} left`
                  : fmtDate(data.current_period_end) || '—'}
                {data.status === 'trialing' && data.trial_ends_at && (
                  <span className="block text-xs font-normal text-gray-500">ends {fmtDate(data.trial_ends_at)}</span>
                )}
              </dd>
            </div>
          </dl>

          {(data.over_plan || data.suggestion) && !legacy && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 space-y-1">
              {data.over_plan && (
                <p>
                  You have {data.over_plan.agents} more {data.over_plan.agents === 1 ? 'person' : 'people'} than {plan?.name} includes.
                  They add {fmtMoney(data.over_plan.extra_cents, plan?.currency)} {perInterval(plan?.interval)}.
                </p>
              )}
              {data.suggestion && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    {suggestionName} would cost {fmtMoney(data.suggestion.amount_cents, plan?.currency)} {perInterval(data.suggestion.interval)} for your team,{' '}
                    {fmtMoney(data.suggestion.savings_cents, plan?.currency)} less.
                  </span>
                  {canPick && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => savePlan({ plan: data.suggestion.plan, interval: data.suggestion.interval })}
                      className="min-h-[36px] px-3 rounded-lg bg-amber-900 text-white text-xs font-semibold disabled:opacity-50"
                    >
                      {busy === 'plan' ? 'Switching…' : `Switch to ${suggestionName}`}
                    </button>
                  )}
                </p>
              )}
            </div>
          )}

          {showPicker && (
            <div className="space-y-3">
              <PlanPicker
                catalog={data.catalog}
                value={choice || { plan: data.catalog.plans[0].key, interval: 'month' }}
                onChange={setChoice}
                seats={seats}
                currentPlan={data.has_subscription && plan ? { plan: plan.key, interval: plan.interval } : null}
                disabled={!!busy}
                name="billing-plan"
              />
              {(data.has_subscription || !data.configured || picking) && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => savePlan()}
                    disabled={!!busy || (!choiceChanged && plan?.chosen)}
                    className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
                  >
                    {busy === 'plan' ? 'Saving…' : data.has_subscription ? 'Switch plan' : 'Save plan'}
                  </button>
                  {picking && (
                    <button type="button" onClick={() => setPicking(false)} className="min-h-[44px] px-4 text-sm text-gray-600 hover:text-black">
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {notice && <p className="text-sm text-green-800">{notice}</p>}

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
              {canPick && !showPicker && (
                <button
                  type="button"
                  onClick={() => setPicking(true)}
                  disabled={!!busy}
                  className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
                >
                  Change plan
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
          {data.configured && trialNoSub && (
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
