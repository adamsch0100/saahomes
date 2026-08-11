/**
 * Admin agent-seat manager (P-1) — create / activate / deactivate teammates.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createAgent, listAgents, patchAgent } from '../../utils/api.js';

const GOLD = '#CFB36E';

export default function AgentsManager({ token }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listAgents(token);
      setAgents(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await createAgent(token, form);
      setForm({ name: '', email: '', phone: '', password: '' });
      await load();
    } catch (err) {
      setError(err.message || 'Could not create agent');
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (agent, status) => {
    setBusyId(agent.id);
    setError(null);
    try {
      await patchAgent(token, agent.id, { status });
      await load();
    } catch (err) {
      setError(err.message || 'Could not update agent');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Add agent seat</h2>
        <p className="text-sm text-gray-500 mt-1">
          Creates a teammate who can sign in at <code className="text-xs bg-gray-100 px-1 rounded">/agent/</code> and
          see the team-pooled pipeline.
        </p>
        <form onSubmit={handleCreate} className="mt-4 grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder="Full name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email</span>
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder="agent@example.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Phone (optional)</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder="970…"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Password (min 8)</span>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder="••••••••"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={creating}
              className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              {creating ? 'Creating…' : 'Create agent'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Agent seats</h2>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="text-sm text-gray-600 hover:text-black min-h-[36px] px-2"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {agents.length === 0 && !loading && (
          <p className="p-6 text-sm text-gray-500">No agent seats yet. Create one above.</p>
        )}
        {agents.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {agents.map((a) => (
              <li key={a.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">
                    {a.name || '—'}
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {a.role}
                    </span>
                    {a.status !== 'active' && (
                      <span className="ml-1 text-[10px] font-bold uppercase tracking-wide text-red-700 bg-red-50 px-1.5 py-0.5 rounded">
                        {a.status}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">{a.email}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.assigned_lead_count != null
                      ? `${a.assigned_lead_count} assigned lead${a.assigned_lead_count === 1 ? '' : 's'}`
                      : ''}
                    {a.phone ? ` · ${a.phone}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  {a.status === 'active' ? (
                    <button
                      type="button"
                      disabled={busyId === a.id || a.role === 'admin'}
                      onClick={() => setStatus(a, 'inactive')}
                      className="min-h-[40px] px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-40"
                      title={a.role === 'admin' ? 'Deactivate admin seats from the users table if needed' : ''}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => setStatus(a, 'active')}
                      className="min-h-[40px] px-3 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Activate
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
