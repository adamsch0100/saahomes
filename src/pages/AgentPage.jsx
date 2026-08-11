/**
 * Agent console — multi-agent seats (P-1) + white-label brand surface (P-2)
 * + Connect CRM / FUB import (P-3a) + Website forms (P-3b)
 * + Market content pack label (P-4).
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
  getAgentMarket,
  connectAgentFub,
  getAgentFubStatus,
  disconnectAgentFub,
  importAgentFubContacts,
  getAgentWebformSlug,
  getAgentWebformStats,
  regenerateAgentWebformSlug,
} from '../utils/api.js';
import { marketPack, resolveTenantBrand } from '../data/marketPack.js';

const AGENT_TOKEN_KEY = 'agentToken';
const AGENT_USER_KEY = 'agentUser';
const GOLD = '#CFB36E';
const WEBFORM_ENDPOINT = 'https://saahomes.com/api/webform/lead';

function buildWebformSnippet(slug, agentLabel) {
  const label = agentLabel || 'your agent';
  return `<!-- SAA Homes lead form — goes straight to ${label} -->
<form action="${WEBFORM_ENDPOINT}" method="POST" style="max-width:420px;font-family:system-ui,sans-serif">
  <input type="hidden" name="slug" value="${slug}" />
  <p style="font-size:13px;color:#555;margin:0 0 12px">This form goes straight to ${label}</p>
  <label style="display:block;margin-bottom:8px">Name<br/>
    <input name="name" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px" />
  </label>
  <label style="display:block;margin-bottom:8px">Email<br/>
    <input name="email" type="email" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px" />
  </label>
  <label style="display:block;margin-bottom:8px">Phone<br/>
    <input name="phone" type="tel" required style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px" />
  </label>
  <label style="display:block;margin-bottom:8px">Interest (optional)<br/>
    <input name="interest" placeholder="Buying, selling, CHFA…" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px" />
  </label>
  <label style="display:block;margin-bottom:12px">Message (optional)<br/>
    <textarea name="message" rows="3" style="width:100%;padding:10px;border:1px solid #ccc;border-radius:6px"></textarea>
  </label>
  <button type="submit" style="background:#CFB36E;color:#000;font-weight:600;border:0;padding:12px 20px;border-radius:8px;cursor:pointer">
    Send message
  </button>
</form>`;
}

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

  // Website forms (P-3b)
  const [webformData, setWebformData] = useState(null);
  const [webformLoading, setWebformLoading] = useState(false);
  const [webformError, setWebformError] = useState(null);
  const [webformCopyMsg, setWebformCopyMsg] = useState(null);
  const [webformRegenBusy, setWebformRegenBusy] = useState(false);

  // Market pack label (P-4) — read-only; admin assigns market_key
  const [agentMarket, setAgentMarket] = useState(null);

  const brand = resolveTenantBrand(agentUser);
  const marketLabel =
    agentMarket?.marketName ||
    agentUser?.brand?.marketName ||
    marketPack.market.name;

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
    setWebformData(null);
    setWebformError(null);
    setWebformCopyMsg(null);
    setAgentMarket(null);
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
        // Prefer brand.marketName from me payload when present
        if (res.data.brand?.marketName || res.data.marketKey) {
          setAgentMarket({
            marketKey: res.data.marketKey || res.data.brand?.marketKey || 'noco',
            marketName:
              res.data.brand?.marketName || marketPack.market.name,
          });
        }
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

  const loadMarket = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      const res = await getAgentMarket(authToken);
      if (res.data) {
        setAgentMarket(res.data);
      }
    } catch {
      // Non-fatal — fall back to me payload / NoCO label
    }
  }, []);

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

  const loadWebform = useCallback(async (authToken) => {
    if (!authToken) return;
    setWebformLoading(true);
    try {
      const [slugRes, statsRes] = await Promise.all([
        getAgentWebformSlug(authToken),
        getAgentWebformStats(authToken),
      ]);
      const slugData = slugRes.data || {};
      const statsData = statsRes.data || {};
      setWebformData({
        slug: slugData.slug || statsData.slug || null,
        endpoint: slugData.endpoint || statsData.endpoint || WEBFORM_ENDPOINT,
        total: typeof statsData.total === 'number' ? statsData.total : 0,
        last7Days: typeof statsData.last7Days === 'number' ? statsData.last7Days : 0,
        lastLeadAt: statsData.lastLeadAt || null,
      });
      setWebformError(null);
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
      setWebformError(err.message || 'Could not load website form settings');
    } finally {
      setWebformLoading(false);
    }
  }, [handleLogout]);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      loadTeammates(token);
      loadMe(token);
      loadMarket(token);
      loadFubStatus(token);
      loadWebform(token);
    }
  }, [token, loadTeammates, loadMe, loadMarket, loadFubStatus, loadWebform]);

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

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      setWebformCopyMsg(label || 'Copied');
      setTimeout(() => setWebformCopyMsg(null), 2000);
    } catch {
      setWebformCopyMsg('Copy failed — select and copy manually');
      setTimeout(() => setWebformCopyMsg(null), 3000);
    }
  };

  const handleWebformRegen = async () => {
    if (!token) return;
    if (!window.confirm('Generate a new form link? Your old slug will stop accepting leads.')) {
      return;
    }
    setWebformRegenBusy(true);
    setWebformError(null);
    try {
      const res = await regenerateAgentWebformSlug(token);
      const data = res.data || {};
      setWebformData((prev) => ({
        ...(prev || {}),
        slug: data.slug,
        endpoint: data.endpoint || WEBFORM_ENDPOINT,
        total: prev?.total ?? 0,
        last7Days: prev?.last7Days ?? 0,
        lastLeadAt: prev?.lastLeadAt ?? null,
      }));
      // Refresh stats so counts stay real
      loadWebform(token);
    } catch (err) {
      setWebformError(err.message || 'Could not regenerate link');
    } finally {
      setWebformRegenBusy(false);
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
                Market: {marketLabel}
                {brand.voiceStyle ? ` · Email voice: ${brand.voiceStyle}` : ''}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                All agents see every contact. Claim to own the follow-up.
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
                  <span className="inline-flex items-center min-h-[36px] px-3 rounded-lg bg-gray-100 text-xs text-gray-700">
                    Market: {marketLabel}
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
                Your key never appears in full in the browser after connect — only a masked suffix.
                Website form leads use this key when connected (see Website forms below).
              </p>
            </div>
          </div>

          {/* Website forms (P-3b) — public capture link + embed snippet */}
          <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-black">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>
                  Website forms
                </p>
                <h2 className="text-base font-semibold text-white">
                  Capture from your site
                  {brand.brandName ? (
                    <span className="font-normal text-gray-400"> · {brand.brandName}</span>
                  ) : null}
                </h2>
              </div>
              <div className="text-xs text-gray-300">
                {webformLoading && webformData == null ? (
                  <span className="inline-block h-4 w-28 rounded bg-gray-700 animate-pulse" />
                ) : webformData?.slug ? (
                  <span>
                    Slug · <span className="font-mono" style={{ color: GOLD }}>{webformData.slug}</span>
                  </span>
                ) : (
                  <span>Loading link…</span>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {webformLoading && webformData == null ? (
                <div className="space-y-3" aria-busy="true">
                  <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-24 rounded-lg bg-gray-100 animate-pulse" />
                  <div className="h-10 w-48 rounded-lg bg-gray-100 animate-pulse" />
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600">
                    Wire your own site&apos;s form to this endpoint. Leads land in your pipeline
                    (assigned to you, source <span className="font-mono text-xs">webform</span>)
                    {fubStatus?.connected
                      ? ' and push to your connected Follow Up Boss account.'
                      : ' and push to the brokerage CRM when FUB is not connected on your seat.'}
                  </p>

                  {/* Stats — real counts only */}
                  <div className="flex flex-wrap gap-3">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-[100px]">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Total</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof webformData?.total === 'number' ? webformData.total : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-[100px]">
                      <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Last 7 days</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof webformData?.last7Days === 'number' ? webformData.last7Days : '—'}
                      </p>
                    </div>
                    {webformData?.lastLeadAt && (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 min-w-[140px]">
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Last lead</p>
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(webformData.lastLeadAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Endpoint + slug */}
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Capture endpoint
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <code className="flex-1 min-h-[44px] flex items-center px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-xs sm:text-sm font-mono text-gray-900 break-all">
                        {webformData?.endpoint || WEBFORM_ENDPOINT}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyText(webformData?.endpoint || WEBFORM_ENDPOINT, 'Endpoint copied')}
                        className="min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-black shrink-0"
                        style={{ backgroundColor: GOLD }}
                      >
                        Copy endpoint
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Your slug (required on every submit)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <code className="flex-1 min-h-[44px] flex items-center px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900">
                        {webformData?.slug || '—'}
                      </code>
                      <button
                        type="button"
                        disabled={!webformData?.slug}
                        onClick={() => copyText(webformData.slug, 'Slug copied')}
                        className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50 shrink-0"
                      >
                        Copy slug
                      </button>
                      <button
                        type="button"
                        disabled={webformRegenBusy || !token}
                        onClick={handleWebformRegen}
                        className="min-h-[44px] px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50 shrink-0"
                      >
                        {webformRegenBusy ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    </div>
                  </div>

                  {/* How to wire */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700 space-y-2">
                    <p className="font-medium text-gray-900">How to link your form</p>
                    <ol className="list-decimal list-inside space-y-1 text-gray-600 text-sm">
                      <li>
                        <span className="font-medium">POST</span> JSON or form fields to{' '}
                        <span className="font-mono text-xs">{WEBFORM_ENDPOINT}</span>
                      </li>
                      <li>
                        Required: <span className="font-mono text-xs">slug</span>,{' '}
                        <span className="font-mono text-xs">email</span>,{' '}
                        <span className="font-mono text-xs">phone</span>
                      </li>
                      <li>
                        Optional: <span className="font-mono text-xs">name</span>,{' '}
                        <span className="font-mono text-xs">interest</span>,{' '}
                        <span className="font-mono text-xs">message</span>,{' '}
                        <span className="font-mono text-xs">area</span>
                      </li>
                      <li>Use your slug above so the lead is assigned to you.</li>
                    </ol>
                  </div>

                  {/* HTML snippet */}
                  {webformData?.slug && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide">
                          HTML snippet
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              buildWebformSnippet(
                                webformData.slug,
                                brand.fromName || brand.brandName || agentUser?.name
                              ),
                              'Snippet copied'
                            )
                          }
                          className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold text-black"
                          style={{ backgroundColor: GOLD }}
                        >
                          Copy snippet
                        </button>
                      </div>
                      <pre className="text-[11px] leading-relaxed p-3 rounded-lg border border-gray-200 bg-gray-900 text-gray-100 overflow-x-auto max-h-48">
                        {buildWebformSnippet(
                          webformData.slug,
                          brand.fromName || brand.brandName || agentUser?.name
                        )}
                      </pre>
                      <p className="text-[11px] text-gray-400">
                        Paste into any page. Label on the form: &quot;This form goes straight to{' '}
                        {brand.fromName || brand.brandName || agentUser?.name || 'you'}&quot;.
                        Email + phone are required.
                      </p>
                    </div>
                  )}

                  {webformCopyMsg && (
                    <p className="text-sm font-medium" style={{ color: '#8a7020' }}>
                      {webformCopyMsg}
                    </p>
                  )}
                </>
              )}

              {webformError && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
                  {webformError}
                </div>
              )}
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
