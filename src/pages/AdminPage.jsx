import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { adminLogin, getSubmissions, getStats, getEmailAbStats } from '../utils/api.js';
import ClientSearchesManager from '../components/admin/ClientSearchesManager.jsx';
import AgentCockpit from '../components/admin/AgentCockpit.jsx';
import AgentsManager from '../components/admin/AgentsManager.jsx';
import SEO from '../components/SEO';

const TYPE_LABELS = {
  digest: 'Listing digest',
  home_value_digest: 'Home-value digest',
};

function formatOpenRate(rate) {
  if (rate == null || Number.isNaN(rate)) return '—';
  return `${(Number(rate) * 100).toFixed(1)}%`;
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [tab, setTab] = useState('cockpit'); // cockpit | leads | searches | agents | email-ab
  const [abStats, setAbStats] = useState(null);
  const [abLoading, setAbLoading] = useState(false);
  const [abError, setAbError] = useState(null);

  useEffect(() => {
    if (token) {
      setIsAuthenticated(true);
      fetchData();
    }
  }, [token]);

  const fetchData = async () => {
    if (!token) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const [submissionsData, statsData] = await Promise.all([
        getSubmissions(token, { type: filterType === 'all' ? '' : filterType }),
        getStats(token),
      ]);
      
      setSubmissions(submissionsData.data || []);
      setStats(statsData.data);
    } catch (err) {
      setError(err.message || 'Failed to load data');
      if (err.message?.includes('token') || err.message?.includes('401') || err.message?.includes('403')) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [filterType, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !token || tab !== 'email-ab') return;
    let cancelled = false;
    (async () => {
      setAbLoading(true);
      setAbError(null);
      try {
        const data = await getEmailAbStats(token);
        if (!cancelled) setAbStats(data);
      } catch (err) {
        if (!cancelled) {
          setAbError(err.message || 'Failed to load A/B stats');
          if (err.message?.includes('token') || err.message?.includes('401') || err.message?.includes('403')) {
            handleLogout();
          }
        }
      } finally {
        if (!cancelled) setAbLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, isAuthenticated, token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await adminLogin(loginData.email, loginData.password);
      if (response.token) {
        setToken(response.token);
        localStorage.setItem('adminToken', response.token);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setSubmissions([]);
    setStats(null);
    setAbStats(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isAuthenticated) {
    return (
      <>
        <SEO
          title="Admin Login"
          description="Admin panel login"
          canonical="https://saahomes.com/admin/"
          robots="noindex, nofollow"
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            <div>
              <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                Admin Login
              </h2>
            </div>
            <form className="mt-8 space-y-6" onSubmit={handleLogin}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div className="rounded-md shadow-sm -space-y-px">
                <div>
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-black focus:border-black focus:z-10 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
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
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
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
        title="Admin Dashboard"
        description="Admin panel dashboard"
        canonical="https://saahomes.com/admin/"
        robots="noindex, nofollow"
      />
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Agent Cockpit</h1>
              <p className="text-sm text-gray-500 mt-1">Scores, heat, stages &amp; follow-ups — FUB stays CRM source of truth.</p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <Link
                to="/agent/"
                className="min-h-[44px] px-4 py-2 bg-white text-gray-800 border border-gray-300 rounded-lg hover:border-black text-sm font-medium flex items-center"
              >
                Agent console
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[44px] px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTab('cockpit')}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'cockpit' ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
            >
              Cockpit
            </button>
            <button
              type="button"
              onClick={() => setTab('leads')}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'leads' ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
            >
              Form Leads
            </button>
            <button
              type="button"
              onClick={() => setTab('searches')}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'searches' ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
            >
              Client Searches
            </button>
            <button
              type="button"
              onClick={() => setTab('agents')}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'agents' ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
            >
              Agent seats
            </button>
            <button
              type="button"
              onClick={() => setTab('email-ab')}
              className={`min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'email-ab' ? 'bg-black text-white' : 'bg-white text-gray-700 border border-gray-200 hover:border-black'}`}
            >
              Email A/B
            </button>
          </div>

          {tab === 'cockpit' ? (
            <AgentCockpit token={token} />
          ) : tab === 'searches' ? (
            <ClientSearchesManager token={token} />
          ) : tab === 'agents' ? (
            <AgentsManager token={token} />
          ) : tab === 'email-ab' ? (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Email A/B subject lines</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Subject lines are A/B tested; opens tracked via a 1×1 pixel. Variants rotate per user, never per send.
                </p>
              </div>

              {abLoading && (
                <div className="p-8 space-y-3" aria-busy="true">
                  <div className="h-4 bg-gray-100 rounded w-1/3 animate-pulse" />
                  <div className="h-10 bg-gray-100 rounded animate-pulse" />
                  <div className="h-10 bg-gray-50 rounded animate-pulse" />
                  <div className="h-10 bg-gray-100 rounded animate-pulse" />
                </div>
              )}

              {abError && !abLoading && (
                <div className="p-8 text-center text-red-600">{abError}</div>
              )}

              {!abLoading && !abError && (!abStats?.variants || abStats.variants.length === 0) && (
                <div className="p-8 text-center text-gray-500">
                  No nurture emails sent yet — stats appear after the first digest run
                </div>
              )}

              {!abLoading && !abError && abStats?.variants?.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Variant
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Sent
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Opened
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Open rate
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {abStats.variants.map((row) => (
                        <tr key={`${row.type}-${row.variant}`} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {TYPE_LABELS[row.type] || row.type}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded bg-black text-white text-xs">
                              {row.variant}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {row.sent}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {row.opened}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium" style={{ color: '#CFB36E' }}>
                            {formatOpenRate(row.open_rate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {abStats.totals && (
                      <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                        <tr>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900" colSpan={2}>
                            Totals
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                            {abStats.totals.sent}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                            {abStats.totals.opened}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-right" style={{ color: '#CFB36E' }}>
                            {formatOpenRate(abStats.totals.open_rate)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </div>
          ) : (
          <>
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Contacts</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalContacts}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Total Market Reports</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.totalMarketReports}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Contacts (7 days)</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.contactsLast7Days}</p>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500">Market Reports (7 days)</h3>
                <p className="text-2xl font-bold text-gray-900">{stats.marketReportsLast7Days}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Submissions</h2>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2"
                >
                  <option value="all">All</option>
                  <option value="contact">Contact Forms</option>
                  <option value="market-report">Market Reports</option>
                </select>
              </div>
            </div>

            {loading && (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            )}

            {error && (
              <div className="p-8 text-center text-red-600">{error}</div>
            )}

            {!loading && !error && submissions.length === 0 && (
              <div className="p-8 text-center text-gray-500">No submissions found</div>
            )}

            {!loading && !error && submissions.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Area/Interest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {submissions.map((submission) => (
                      <tr key={`${submission.type}-${submission.id}`} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.type === 'market-report' ? 'Market Report' : 'Contact'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.first_name} {submission.last_name || ''}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.phone || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {submission.area || submission.interest || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(submission.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

