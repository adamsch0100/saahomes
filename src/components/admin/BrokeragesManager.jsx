/**
 * Platform console — brokerages (tenants). Only rendered when /api/account/me
 * says platform === true. Add a brokerage (owner gets an invite email),
 * list them, suspend / reactivate, and set which MLS listings each one shows.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createTenant, listTenants, patchTenant } from '../../utils/api.js';
import TenantListingsPanel from './TenantListingsPanel.jsx';
import PlatformBillingPanel from './PlatformBillingPanel.jsx';
import { fmtMoney } from '../billing/PlanPicker.jsx';

const GOLD = 'var(--brand-accent)';

const emptyForm = {
  name: '',
  slug: '',
  primary_domain: '',
  owner_name: '',
  owner_email: '',
};

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const BILLING_PILL = {
  trialing: ['Trial', 'text-blue-700 bg-blue-50'],
  active: ['Paying', 'text-green-700 bg-green-50'],
  grace: ['Trial ended', 'text-amber-800 bg-amber-50'],
  past_due: ['Past due', 'text-amber-800 bg-amber-50'],
  canceled: ['Canceled', 'text-gray-600 bg-gray-100'],
};

/** Billing status for the platform console: plan, trial days left, grace, paused, and MRR. */
function BillingPill({ billing, home }) {
  if (home) return <span className="text-xs text-gray-400">Not billed</span>;
  if (!billing || !billing.status) return <span className="text-xs text-gray-400">—</span>;
  const [label, cls] = billing.suspended ? ['Paused', 'text-red-700 bg-red-50'] : BILLING_PILL[billing.status] || [billing.status, 'text-gray-600 bg-gray-100'];
  const until = billing.status === 'trialing' ? billing.trial_ends_at : billing.grace_ends_at || billing.current_period_end;
  const days = until ? Math.ceil((new Date(until).getTime() - Date.now()) / 86400000) : null;
  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className={`self-start text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
      {!billing.suspended && days != null && days >= 0 && billing.status !== 'active' ? (
        <span className="text-xs text-gray-500">{days} day{days === 1 ? '' : 's'} left</span>
      ) : billing.seats_billed ? (
        <span className="text-xs text-gray-500">{billing.seats_billed} seat{billing.seats_billed === 1 ? '' : 's'}</span>
      ) : null}
      {billing.plan_name && (
        <span className="text-xs text-gray-700">
          {billing.plan_name}{billing.interval === 'year' ? ', yearly' : ''}
          {billing.mrr_cents > 0 && <span className="text-gray-500"> · {fmtMoney(billing.mrr_cents)}/mo</span>}
        </span>
      )}
    </span>
  );
}

export default function BrokeragesManager({ token }) {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [listingsFor, setListingsFor] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listTenants(token);
      setTenants(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load brokerages');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleNameChange = (name) => {
    setForm((f) => ({ ...f, name, slug: slugEdited ? f.slug : slugify(name) }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const ownerEmail = form.owner_email.trim();
      await createTenant(token, {
        name: form.name.trim(),
        slug: slugify(form.slug),
        primary_domain: form.primary_domain.trim() || undefined,
        owner_name: form.owner_name.trim(),
        owner_email: ownerEmail,
      });
      setForm(emptyForm);
      setSlugEdited(false);
      setNotice(`Invite sent to ${ownerEmail}`);
      await load();
    } catch (err) {
      setError(err.message || 'Could not add brokerage');
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (tenant) => {
    const next = tenant.status === 'suspended' ? 'active' : 'suspended';
    if (
      next === 'suspended' &&
      !window.confirm(`Suspend ${tenant.name}? Their site and staff sign-ins stop working until reactivated.`)
    ) {
      return;
    }
    setBusyId(tenant.id);
    setError(null);
    setNotice(null);
    try {
      const res = await patchTenant(token, tenant.id, { status: next });
      const updated = res.data || { status: next };
      setTenants((list) => list.map((row) => (row.id === tenant.id ? { ...row, ...updated } : row)));
    } catch (err) {
      setError(err.message || 'Could not update brokerage');
    } finally {
      setBusyId(null);
    }
  };

  const inputClass = 'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm';

  return (
    <div className="space-y-6">
      <PlatformBillingPanel token={token} />

      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Add brokerage</h2>
        <p className="text-sm text-gray-500 mt-1">
          Creates the brokerage and emails the owner an invite to set their password and sign in at{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">/admin/</code>.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Brokerage name</span>
            <input
              required
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={inputClass}
              placeholder="Front Range Realty"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Slug</span>
            <input
              required
              value={form.slug}
              onChange={(e) => {
                setSlugEdited(e.target.value !== '');
                setForm({ ...form, slug: e.target.value.toLowerCase() });
              }}
              onBlur={() => setForm((f) => ({ ...f, slug: slugify(f.slug) }))}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Lowercase letters, numbers and hyphens"
              className={`${inputClass} font-mono`}
              placeholder="front-range-realty"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium text-gray-600">Primary domain (optional)</span>
            <input
              value={form.primary_domain}
              onChange={(e) => setForm({ ...form, primary_domain: e.target.value })}
              className={inputClass}
              placeholder="frontrangerealty.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Owner name</span>
            <input
              required
              value={form.owner_name}
              onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
              className={inputClass}
              placeholder="Full name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Owner email</span>
            <input
              required
              type="email"
              value={form.owner_email}
              onChange={(e) => setForm({ ...form, owner_email: e.target.value })}
              className={inputClass}
              placeholder="owner@example.com"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              {creating ? 'Adding…' : 'Add brokerage'}
            </button>
          </div>
        </form>
      </div>

      {notice && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">{notice}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Brokerages
            {tenants.some((t) => t.billing?.mrr_cents > 0) && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                {fmtMoney(tenants.reduce((sum, t) => sum + (t.billing?.mrr_cents || 0), 0))} a month in total
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-black min-h-[36px] px-2"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {tenants.length === 0 && !loading && (
          <p className="p-6 text-sm text-gray-500">No brokerages yet. Add one above.</p>
        )}
        {tenants.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domain</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Listings</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Billing</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Agents</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      <p className="font-semibold text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400 font-mono">{t.slug}</p>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700">{t.primary_domain || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          t.status === 'suspended' ? 'text-red-700 bg-red-50' : 'text-green-700 bg-green-50'
                        }`}
                      >
                        {t.status || 'active'}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      <button
                        type="button"
                        onClick={() => setListingsFor(listingsFor?.id === t.id ? null : t)}
                        className="min-h-[36px] text-left underline-offset-2 hover:underline"
                        aria-expanded={listingsFor?.id === t.id}
                      >
                        {t.live_feeds?.length || t.id === 1 ? (
                          <span className="text-green-700 font-semibold">Live: {(t.live_feeds?.length ? t.live_feeds : ['ires']).map((k) => k.toUpperCase()).join(', ')}</span>
                        ) : (
                          <span className="text-amber-700 font-semibold">Sample homes</span>
                        )}
                        <span className="block text-xs text-gray-500">Listings (MLS) ›</span>
                      </button>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm">
                      <BillingPill billing={t.billing} home={t.id === 1} />
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{t.agent_count ?? '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{t.lead_count ?? '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-sm text-gray-700">{t.owner_email || '—'}</td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      {t.status === 'suspended' ? (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => toggleStatus(t)}
                          className="min-h-[40px] px-3 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      ) : t.id === 1 ? (
                        <span className="text-xs text-gray-400">Home brokerage</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => toggleStatus(t)}
                          className="min-h-[40px] px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-40"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {listingsFor && (
        <TenantListingsPanel key={listingsFor.id} token={token} tenant={listingsFor} onChanged={load} />
      )}
    </div>
  );
}
