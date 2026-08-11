/**
 * Agent console — multi-agent seats (P-1).
 * Login → team-pooled cockpit (all client contacts) with claim/assign.
 * Separate token key (agentToken) from adminToken. No admin suite tools.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import AgentCockpit from '../components/admin/AgentCockpit.jsx';
import SEO from '../components/SEO';
import { agentLogin, getAgentTeammates } from '../utils/api.js';

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

  const handleLogout = useCallback(() => {
    setToken(null);
    setAgentUser(null);
    localStorage.removeItem(AGENT_TOKEN_KEY);
    localStorage.removeItem(AGENT_USER_KEY);
    setIsAuthenticated(false);
    setTeammates([]);
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

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      loadTeammates(token);
    }
  }, [token, loadTeammates]);

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
          <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <p
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: GOLD }}
              >
                Agent console
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Team pipeline
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {agentUser?.name || agentUser?.email
                  ? `Signed in as ${agentUser.name || agentUser.email}`
                  : 'Team-pooled contacts'}
                {' · '}
                All agents see every contact. Claim to own the follow-up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
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

          <AgentCockpit
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
