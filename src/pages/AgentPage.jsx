/**
 * Agent console — multi-agent seats (P-1) + white-label brand surface (P-2)
 * + Connect CRM / FUB import (P-3a).
 * Login → team-pooled cockpit (all client contacts) with claim/assign.
 * Separate token key (agentToken) from adminToken. No admin suite tools.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AgentCockpit from '../components/admin/AgentCockpit.jsx';
import SEO from '../components/SEO';
import {
  agentLogin,
  getAgentTeammates,
  getAgentMe,
  connectAgentFub,
  getAgentFubStatus,
  disconnectAgentFub,
  importAgentFubContacts,
} from '../utils/api.js';
import { marketPack, resolveTenantBrand } from '../data/marketPack.js';

const AGENT_TOKEN_KEY = 'agentToken';
const AGENT_USER_KEY = 'agentUser';
const GOLD = '#CFB36E';

export default function AgentPage() {
  const [token, setToken] = useState(() => localStorage.getItem(AGENT_TOKEN_KEY));
  const [agentUser, setAgentUser] = useState(() => {
    try {
      const raw = localStorage.getItem(AGENT_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [teammates, setTeammates] = useState([]);
  const [showBrandPreview, setShowBrandPreview] = useState(false);

  // Connect CRM (P-3a)
  const [fubStatus, setFubStatus] = useState(null);
  const [fubStatusLoading, setFubStatusLoading] = useState(false);
  const [fubApiKeyInput, setFubApiKeyInput] = useState('');
  const [fubConnectBusy, setFubConnectBusy] = useState(false);
  const [fubImportBusy, setFubImportBusy] = useState(false);
  const [fubDisconnectBusy, setFubDisconnectBusy] = useState(false);
  const [fubError, setFubError] = useState(null);
  const [fubImportResult, setFubImportResult] = useState(null);
  const [cockpitRefreshKey, setCockpitRefreshKey] = useState(0);

  const brand = resolveTenantBrand(agentUser);

  const handleLogout = useCallback(() => {
    setToken(null);
    setAgentUser(null);
    localStorage.removeItem(AGENT_TOKEN_KEY);
    localStorage.removeItem(AGENT_USER_KEY);
    setIsAuthenticated(false);
    setTeammates([]);
    setShowBrandPreview(false);
    setFubStatus(null);
    setFubApiKeyInput('');
    setFubError(null);
    setFubImportResult(null);
  }, []);

  const loadTeammates = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      const res = await getAgentTeammates(authToken);
      setTeammates(res.data || []);
    } catch (err) {
      if (
        err.message?.includes('token') ||
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('Invalid') ||
        err.message?.includes('expired')
      ) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  const loadMe = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      const res = await getAgentMe(authToken);
      if (res.data) {
        setAgentUser(res.data);
        localStorage.setItem(AGENT_USER_KEY, JSON.stringify(res.data));
      }
    } catch (err) {
      if (
        err.message?.includes('token') ||
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('Invalid') ||
        err.message?.includes('expired')
      ) {
        handleLogout();
      }
    }
  }, [handleLogout]);

  const loadFubStatus = useCallback(async (authToken) => {
    if (!authToken) return;
    setFubStatusLoading(true);
    try {
      const res = await getAgentFubStatus(authToken);
      setFubStatus(res.data || { connected: false });
      setFubError(null);
    } catch (err) {
      if (
        err.message?.includes('token') ||
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('Invalid') ||
        err.message?.includes('expired')
      ) {
        handleLogout();
        return;
      }
      setFubStatus({ connected: false });
    } finally {
      setFubStatusLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      loadTeammates(token);
      loadMe(token);
      loadFubStatus(token);
    }
  }, [token, loadTeammates, loadMe, loadFubStatus]);

  const handleFubConnect = async (e) => {
    e.preventDefault();
    if (!token || !fubApiKeyInput.trim()) return;
    setFubConnectBusy(true);
    setFubError(null);
    setFubImportResult(null);
    try {
      const res = await connectAgentFub(token, fubApiKeyInput.trim());
      setFubStatus(res.data || { connected: true });
      setFubApiKeyInput('');
    } catch (err) {
      setFubError(err.message || 'Could not connect Follow Up Boss');
    } finally {
      setFubConnectBusy(false);
    }
  };

  const handleFubDisconnect = async () => {
    if (!token) return;
    if (!window.confirm('Disconnect Follow Up Boss? Your imported contacts stay in the pipeline.')) {
      return;
    }
    setFubDisconnectBusy(true);
    setFubError(null);
    setFubImportResult(null);
    try {
      const res = await disconnectAgentFub(token);
      setFubStatus(res.data || { connected: false });
    } catch (err) {
      setFubError(err.message || 'Could not disconnect');
    } finally {
      setFubDisconnectBusy(false);
    }
  };

  const handleFubImport = async () => {
    if (!token) return;
    setFubImportBusy(true);
    setFubError(null);
    setFubImportResult(null);
    try {
      const res = await importAgentFubContacts(token);
      const data = res.data || {};
      setFubImportResult(data);
      if (data.status) setFubStatus(data.status);
      setCockpitRefreshKey((k) => k + 1);
    } catch (err) {
      setFubError(err.message || 'Import failed');
    } finally {
      setFubImportBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await agentLogin(loginData.email, loginData.password);
      if (response.token) {
        setToken(response.token);
        localStorage.setItem(AGENT_TOKEN_KEY, response.token);
        const user = response.data || null;
        setAgentUser(user);
        if (user) localStorage.setItem(AGENT_USER_KEY, JSON.stringify(user));
        setIsAuthenticated(true);
      } else {
        setError('Login failed — no token returned');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <>
        <SEO
          title="Agent Console Login"
          description="Agent console login"
          canonical="https://saahomes.com/agent/"
          robots="noindex, nofollow"
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div className="text-center">
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                SAA Homes
              </p>
              <h2 className="mt-2 text-center text-3xl font-extrabold text-gray-900">
                Agent console
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                Team pipeline — claim leads, follow up, close.
              </p>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="agent-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="agent-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="agent-password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="agent-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                </div>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-[#CFB36E] hover:bg-[#b89a55] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <SEO
        title="Agent Console"
        description="Agent pipeline console"
        canonical="https://saahomes.com/agent/"
        robots="noindex, nofollow"
      />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Brand header (P-2) — resolved tenant brand, not hardcoded SAA-only */}
          <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                {brand.brandName}
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Team pipeline
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {brand.agentName || agentUser?.email
                  ? `${brand.agentName || agentUser.email}`
                  : 'Team-pooled contacts'}
                {brand.brokerage ? ` · ${brand.brokerage}` : ''}
                {brand.phone ? ` · ${brand.phone}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                All agents see every contact. Claim to own the follow-up.
                {brand.voiceStyle ? ` · Email voice: ${brand.voiceStyle}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowBrandPreview((v) => !v)}
                className="min-h-[44px] px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:border-black text-sm font-medium flex items-center"
              >
                {showBrandPreview ? 'Hide brand preview' : 'Branded site'}
              </button>
              {agentUser?.role === 'admin' && (
                <Link
                  to="/admin/"
                  className="min-h-[44px] px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:border-black text-sm font-medium flex items-center"
                >
                  Admin suite
                </Link>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Lightweight brand chrome preview — name/brokerage/phone swap only (no full search rebuild) */}
          {showBrandPreview && (
            <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <div className="bg-black px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <span className="text-sm font-extrabold tracking-wide" style={{ color: GOLD }}>
                    {String(brand.brandName || marketPack.market.brand).toUpperCase()}
                  </span>
                  <span className="block sm:inline sm:ml-3 text-xs text-gray-400">
                    {brand.headerSubline}
                  </span>
                </div>
                <div className="text-xs text-gray-300">
                  {brand.phone ? (
                    <a href={brand.tel} className="hover:text-white" style={{ color: GOLD }}>
                      {brand.phone}
                    </a>
                  ) : null}
                  {brand.agentName ? (
                    <span className="ml-3 text-gray-400">{brand.agentName}</span>
                  ) : null}
                </div>
              </div>
              <div className="bg-white px-4 py-4">
                <p className="text-sm font-semibold text-gray-900">
                  Homes for sale — {marketPack.market.name}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Preview only: search chrome would show your brand name, brokerage, and phone.
                  Custom domains (P-2b) are not included in this release.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    Brand: {brand.brandName}
                  </span>
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    Brokerage: {brand.brokerage}
                  </span>
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    Phone: {brand.phone}
                  </span>
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    From-name: {brand.fromName}
                  </span>
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    Voice: {brand.voiceStyle}
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-gray-400">
                  {marketPack.fairHousing} · Brand edits: admin → Agents. Emails use this brand only when
                  a lead is assigned to you.
                </p>
              </div>
            </div>
          )}

          {/* Connect CRM (P-3a) — per-agent Follow Up Boss key + contact import */}
          <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                  Connect CRM
                </p>
                <h2 className="text-base font-semibold text-white">
                  Follow Up Boss
                  {brand.brandName ? (
                    <span className="font-normal text-gray-400"> · {brand.brandName}</span>
                  ) : null}
                </h2>
              </div>
              <div className="text-xs text-gray-300">
                {fubStatusLoading && fubStatus == null ? (
                  <span className="inline-block h-4 w-24 rounded bg-gray-700 animate-pulse" />
                ) : fubStatus?.connected ? (
                  <span>
                    Connected · <span className="font-mono" style={{ color: GOLD }}>{fubStatus.maskedKey}</span>
                  </span>
                ) : (
                  <span>Not connected</span>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {fubStatusLoading && fubStatus == null ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-10 w-40 rounded-lg bg-gray-100 animate-pulse" />
                </div>
              ) : !fubStatus?.connected ? (
                <form onSubmit={handleFubConnect} className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Paste your Follow Up Boss API key to import contacts into your team pipeline.
                    The key is verified with a read-only call before it is saved — invalid keys are never stored.
                  </p>
                  <label htmlFor="agent-fub-key" className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                    API key
                  </label>
                  <input
                    id="agent-fub-key"
                    type="password"
                    autoComplete="off"
                    value={fubApiKeyInput}
                    onChange={(e) => setFubApiKeyInput(e.target.value)}
                    placeholder="Follow Up Boss API key"
                    className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    type="submit"
                    disabled={fubConnectBusy || !fubApiKeyInput.trim()}
                    className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                    style={{ backgroundColor: GOLD }}
                  >
                    {fubConnectBusy ? 'Verifying…' : 'Connect'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Key on file: <span className="font-mono text-gray-900">{fubStatus.maskedKey}</span>
                    {fubStatus.lastImportAt ? (
                      <span className="text-gray-400">
                        {' '}
                        · Last import {new Date(fubStatus.lastImportAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-gray-400"> · No import yet</span>
                    )}
                    {typeof fubStatus.importedCount === 'number' ? (
                      <span className="text-gray-400">
                        {' '}
                        · {fubStatus.importedCount} imported contact{fubStatus.importedCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleFubImport}
                      disabled={fubImportBusy || fubDisconnectBusy}
                      className="min-h-[44px] px-5 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                      style={{ backgroundColor: GOLD }}
                    >
                      {fubImportBusy ? 'Importing contacts…' : 'Import contacts'}
                    </button>
                    <button
                      type="button"
                      onClick={handleFubDisconnect}
                      disabled={fubDisconnectBusy || fubImportBusy}
                      className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
                    >
                      {fubDisconnectBusy ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  </div>
                  {fubImportResult && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                      <p className="font-medium">
                        Imported {fubImportResult.imported ?? 0}, skipped{' '}
                        {fubImportResult.duplicates ?? 0} duplicate
                        {(fubImportResult.duplicates ?? 0) === 1 ? '' : 's'}
                        {(fubImportResult.failed ?? 0) > 0
                          ? `, ${fubImportResult.failed} could not import`
                          : ''}
                        {fubImportResult.total != null
                          ? ` (of ${fubImportResult.total} in FUB)`
                          : ''}
                        .
                      </p>
                      {fubImportResult.truncated && (
                        <p className="text-xs text-amber-800 mt-1">
                          Import capped at the first 2,500 contacts — re-run later if you need more.
                        </p>
                      )}
                      {fubImportResult.warning && (
                        <p className="text-xs text-amber-800 mt-1">
                          Partial import: {fubImportResult.warning}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {fubError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                  {fubError}
                </div>
              )}

              <p className="text-[11px] text-gray-400">
                Website form wiring to your CRM is next (P-3b). Your key never appears in full in the
                browser after connect — only a masked suffix.
              </p>
            </div>
          </div>

          <AgentCockpit
            key={cockpitRefreshKey}
            token={token}
            apiPrefix="/api/agent"
            showAdminTools={false}
            showAssignment
            teammates={teammates}
            currentAgentId={agentUser?.id ?? null}
          />
        </div>
      </div>
    </div>
  );
}
