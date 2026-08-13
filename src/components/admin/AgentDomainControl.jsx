/**
 * Admin control: set / verify / remove an agent's custom domain.
 * Verification is a real DNS TXT check — this UI never fakes success.
 */
import React, { useEffect, useState } from 'react';
import { deleteAgentDomain, setAgentDomain, verifyAgentDomain } from '../../utils/api.js';

const GOLD = '#CFB36E';

function statusBadge(agent) {
  if (agent.domain_verified_at && agent.custom_domain) {
    const when = new Date(agent.domain_verified_at);
    const label = Number.isNaN(when.getTime())
      ? 'Verified'
      : `Verified ✓ ${when.toLocaleDateString()}`;
    return {
      label,
      className: 'text-[10px] font-bold uppercase tracking-wide text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded',
    };
  }
  if (agent.custom_domain) {
    return {
      label: 'Pending TXT',
      className: 'text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded',
    };
  }
  return {
    label: 'Unverified',
    className: 'text-[10px] font-bold uppercase tracking-wide text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded',
  };
}

export default function AgentDomainControl({ token, agent, onUpdated }) {
  const [domainInput, setDomainInput] = useState(agent.custom_domain || '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  useEffect(() => {
    setDomainInput(agent.custom_domain || '');
  }, [agent.custom_domain]);

  const tokenValue = agent.domain_verify_token || '';
  const txtValue = tokenValue ? `saa-verify=${tokenValue}` : '';
  const badge = statusBadge(agent);

  const handleSet = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await setAgentDomain(token, agent.id, domainInput.trim() || null);
      onUpdated?.(res.data);
      setInfo(
        res.txt
          ? `Create this TXT record at ${res.data?.custom_domain || domainInput}: ${res.txt}`
          : 'Domain cleared.'
      );
      setOpen(true);
    } catch (err) {
      setError(err.message || 'Could not set domain');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await verifyAgentDomain(token, agent.id);
      onUpdated?.(res.data);
      setInfo('Domain verified. Visitors on that host will see this agent\'s brand.');
    } catch (err) {
      setError(err.message || 'TXT record not found yet');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await deleteAgentDomain(token, agent.id);
      setDomainInput('');
      onUpdated?.(res.data);
      setInfo('Custom domain removed.');
    } catch (err) {
      setError(err.message || 'Could not remove domain');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">Custom domain</span>
        <span className={badge.className}>{badge.label}</span>
        {agent.custom_domain ? (
          <span className="text-xs font-mono text-gray-700">{agent.custom_domain}</span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-gray-600 hover:text-black min-h-[32px] px-2"
        >
          {open ? 'Hide' : 'Manage'}
        </button>
      </div>

      {open && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-3">
          <form onSubmit={handleSet} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="homes.example.com"
              className="flex-1 min-h-[40px] border border-gray-300 rounded-lg px-3 text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="submit"
              disabled={busy}
              className="min-h-[40px] px-4 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
              style={{ backgroundColor: GOLD }}
            >
              {busy ? 'Saving…' : 'Set'}
            </button>
          </form>

          {txtValue ? (
            <div className="text-xs text-gray-700 space-y-1">
              <p>
                Create a DNS <span className="font-semibold">TXT</span> record on{' '}
                <span className="font-mono">{agent.custom_domain}</span> with this exact value:
              </p>
              <code className="block bg-white border border-gray-200 rounded px-3 py-2 font-mono text-[12px] break-all">
                {txtValue}
              </code>
              <p className="text-gray-500">
                Point the hostname at this app (Railway custom domain), then click Verify.
                Propagation can take a few minutes.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || !!agent.domain_verified_at}
                  onClick={handleVerify}
                  className="min-h-[40px] px-4 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-40"
                >
                  {agent.domain_verified_at ? 'Verified' : 'Verify'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRemove}
                  className="min-h-[40px] px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:border-black disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}
          {info && !error && (
            <p className="text-sm text-gray-700">{info}</p>
          )}
        </div>
      )}
    </div>
  );
}
