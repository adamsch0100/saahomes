/**
 * The plans side by side with a Monthly / Yearly switch. Used on /start (so a
 * brokerage knows the price before its trial) and in the owner's Billing card.
 *
 * catalog: { plans: [{ key, name, tagline, included, month: { base_cents,
 * extra_cents }, year: {…} }], yearly_months, currency } from the API.
 * With `seats`, each plan also shows what this team would pay.
 */
import React from 'react';

export function fmtMoney(cents, currency = 'usd') {
  const amount = Number(cents || 0) / 100;
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: String(currency || 'usd').toUpperCase(),
    maximumFractionDigits: amount % 1 ? 2 : 0,
    minimumFractionDigits: amount % 1 ? 2 : 0,
  });
}

export const perInterval = (interval) => (interval === 'year' ? 'a year' : 'a month');

/** What `seats` people cost per period on one plan. */
export function planCost(plan, interval, seats) {
  const t = plan?.[interval] || plan?.month;
  if (!t) return 0;
  return t.base_cents + Math.max(0, Math.floor(seats || 1) - plan.included) * t.extra_cents;
}

export function IntervalSwitch({ value, onChange, yearlyMonths = 10, disabled = false }) {
  const free = 12 - (yearlyMonths || 10);
  const options = [
    { key: 'month', label: 'Monthly' },
    { key: 'year', label: free > 0 ? `Yearly · ${free} month${free === 1 ? '' : 's'} free` : 'Yearly' },
  ];
  return (
    <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          disabled={disabled}
          onClick={() => onChange(o.key)}
          className={`min-h-[40px] px-3 rounded-md text-sm font-medium ${value === o.key ? 'bg-gray-900 text-white' : 'text-gray-700 hover:text-black'} disabled:opacity-50`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function PlanPicker({
  catalog, value, onChange, seats = null, currentPlan = null, disabled = false, name = 'plan',
}) {
  if (!catalog?.plans?.length) return null;
  const interval = value?.interval === 'year' ? 'year' : 'month';
  const currency = catalog.currency || 'usd';
  return (
    <div className="space-y-3">
      <IntervalSwitch
        value={interval}
        yearlyMonths={catalog.yearly_months}
        disabled={disabled}
        onChange={(iv) => onChange({ plan: value?.plan || catalog.plans[0].key, interval: iv })}
      />
      <div role="radiogroup" aria-label="Plan" className="grid sm:grid-cols-3 gap-3">
        {catalog.plans.map((p) => {
          const t = p[interval];
          const selected = value?.plan === p.key;
          const current = currentPlan && currentPlan.plan === p.key && currentPlan.interval === interval;
          return (
            <label
              key={p.key}
              className={`relative flex flex-col rounded-xl border p-4 cursor-pointer bg-white ${selected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200 hover:border-gray-400'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                name={name}
                value={p.key}
                checked={selected}
                disabled={disabled}
                onChange={() => onChange({ plan: p.key, interval })}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-900">{p.name}</span>
                {current && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-50 text-green-700">Current</span>}
              </span>
              <span className="mt-2 text-2xl font-bold text-gray-900">
                {fmtMoney(t.base_cents, currency)}
                <span className="text-sm font-normal text-gray-500"> {perInterval(interval)}</span>
              </span>
              <span className="mt-1 text-sm text-gray-700">{p.included} agents included</span>
              <span className="text-sm text-gray-500">then {fmtMoney(t.extra_cents, currency)} per agent {perInterval(interval)}</span>
              {seats != null && (
                <span className="mt-2 text-xs text-gray-600">
                  For your {seats} {seats === 1 ? 'person' : 'people'}: <strong>{fmtMoney(planCost(p, interval, seats), currency)}</strong> {perInterval(interval)}
                </span>
              )}
              {p.tagline && <span className="mt-2 text-xs text-gray-500">{p.tagline}</span>}
            </label>
          );
        })}
      </div>
    </div>
  );
}
