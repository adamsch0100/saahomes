/**
 * Admin agent-seat manager (P-1 + P-2 brand fields).
 * Create / activate / deactivate teammates; set brand + voice for white-label emails.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { createAgent, listAgents, patchAgent } from '../../utils/api.js';
import { marketPack } from '../../data/marketPack.js';
import AgentDomainControl from './AgentDomainControl.jsx';

const GOLD = '#CFB36E';
const VOICE_STYLES = marketPack.agentVoice?.voiceStyles || ['warm', 'professional', 'short'];

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  password: '',
  brand_name: '',
  brokerage_name: '',
  brand_phone: '',
  voice_style: 'warm',
};

export default function AgentsManager({ token }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    brand_name: '',
    brokerage_name: '',
    brand_phone: '',
    voice_style: 'warm',
  });

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
      const body = {
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        brand_name: form.brand_name.trim() || form.name.trim(),
        brokerage_name: form.brokerage_name.trim() || undefined,
        brand_phone: form.brand_phone.trim() || undefined,
        voice_style: form.voice_style || 'warm',
      };
      await createAgent(token, body);
      setForm(emptyForm);
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

  const openEdit = (agent) => {
    setEditId(agent.id);
    setEditForm({
      brand_name: agent.brand_name || agent.name || '',
      brokerage_name: agent.brokerage_name || '',
      brand_phone: agent.brand_phone || '',
      voice_style: agent.voice_style || 'warm',
    });
  };

  const applyAgentUpdate = (updated) => {
    if (!updated?.id) return;
    setAgents((list) => list.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
  };

  const saveBrand = async (agentId) => {
    setBusyId(agentId);
    setError(null);
    try {
      await patchAgent(token, agentId, {
        brand_name: editForm.brand_name.trim() || null,
        brokerage_name: editForm.brokerage_name.trim() || null,
        brand_phone: editForm.brand_phone.trim() || null,
        voice_style: editForm.voice_style || 'warm',
      });
      setEditId(null);
      await load();
    } catch (err) {
      setError(err.message || 'Could not update brand');
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
          see the team-pooled pipeline. Brand fields power white-label nurture emails for assigned leads.
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
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Brand name</span>
            <input
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder="Defaults to agent name"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Brokerage</span>
            <input
              value={form.brokerage_name}
              onChange={(e) => setForm({ ...form, brokerage_name: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder={marketPack.market.brokerage}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Brand phone</span>
            <input
              type="tel"
              value={form.brand_phone}
              onChange={(e) => setForm({ ...form, brand_phone: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm"
              placeholder={marketPack.market.phone}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Email voice</span>
            <select
              value={form.voice_style}
              onChange={(e) => setForm({ ...form, voice_style: e.target.value })}
              className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white"
            >
              {VOICE_STYLES.map((v) => (
                <option key={v} value={v}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </option>
              ))}
            </select>
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
              <li key={a.id} className="px-5 py-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
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
                    <p className="text-xs text-gray-500 mt-1">
                      Brand:{' '}
                      <span className="font-medium text-gray-700">
                        {a.brand?.brandName || a.brand_name || marketPack.market.brand}
                      </span>
                      {' · '}
                      {a.brand?.brokerage || a.brokerage_name || marketPack.market.brokerage}
                      {' · '}
                      {a.brand?.phone || a.brand_phone || a.phone || marketPack.market.phone}
                      {' · voice '}
                      <span className="uppercase tracking-wide">{a.voice_style || 'warm'}</span>
                    </p>
                    <AgentDomainControl token={token} agent={a} onUpdated={applyAgentUpdate} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => (editId === a.id ? setEditId(null) : openEdit(a))}
                      className="min-h-[40px] px-3 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-40"
                    >
                      {editId === a.id ? 'Cancel brand' : 'Edit brand'}
                    </button>
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
                </div>
                {editId === a.id && (
                  <div className="mt-4 grid sm:grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Brand name</span>
                      <input
                        value={editForm.brand_name}
                        onChange={(e) => setEditForm({ ...editForm, brand_name: e.target.value })}
                        className="mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Brokerage</span>
                      <input
                        value={editForm.brokerage_name}
                        onChange={(e) => setEditForm({ ...editForm, brokerage_name: e.target.value })}
                        className="mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Brand phone</span>
                      <input
                        value={editForm.brand_phone}
                        onChange={(e) => setEditForm({ ...editForm, brand_phone: e.target.value })}
                        className="mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-600">Email voice</span>
                      <select
                        value={editForm.voice_style}
                        onChange={(e) => setEditForm({ ...editForm, voice_style: e.target.value })}
                        className="mt-1 w-full min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm bg-white"
                      >
                        {VOICE_STYLES.map((v) => (
                          <option key={v} value={v}>
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        disabled={busyId === a.id}
                        onClick={() => saveBrand(a.id)}
                        className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                        style={{ backgroundColor: GOLD }}
                      >
                        {busyId === a.id ? 'Saving…' : 'Save brand'}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
