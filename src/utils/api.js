import { trackLeadConversion } from './analytics.js';
import { isCustomDomain } from './tenant.js';

const API_BASE_URL = (() => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://saahomes.com';
})();

function trackSuccessfulLead(leadType, formData) {
  trackLeadConversion(leadType, {
    sourcePage: formData?.sourcePage,
    landingPage: formData?.landingPage,
    utmSource: formData?.utmSource,
    utmMedium: formData?.utmMedium,
    utmCampaign: formData?.utmCampaign,
  });
}

export const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  // options first, then headers: a caller's headers (e.g. Authorization) must
  // add to the JSON Content-Type, not replace it, or the server sees no body.
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      // The brokerage requires two-step sign-in and this account hasn't set it
      // up: the token only works on /api/account/*. Pages show the setup screen.
      if (response.status === 403 && data?.code === '2fa_setup_required') {
        const setupError = new Error('Your brokerage requires two-step sign-in. Set it up to continue.');
        setupError.code = '2fa_setup_required';
        setupError.status = 403;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('saa-2fa-setup-required'));
        }
        throw setupError;
      }
      if (data?.errors?.length) {
        throw new Error(data.errors.map((e) => e.msg).join(', '));
      }
      // SAA's phone only on SAA's own site; another brokerage's visitors get a plain retry.
      throw new Error(data?.error || (isCustomDomain()
        ? `Request failed (${response.status}). Please try again.`
        : `Request failed (${response.status}). Please call (970) 999-1407.`));
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError') {
      throw new Error(isCustomDomain()
        ? 'Unable to reach our servers. Please check your connection and try again.'
        : 'Unable to reach our servers. Please call (970) 999-1407 or email info@saahomes.com.');
    }
    console.error('API request failed:', error);
    throw error;
  }
};

export const submitContactForm = async (formData) => {
  const result = await apiRequest('/api/contact', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('contact', formData);
  return result;
};

/** Luxury hub concierge form — same /api/contact pipe, tagged lead_type=luxury. */
export const submitLuxuryLeadForm = async (formData) => {
  const result = await apiRequest('/api/contact', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('luxury', formData);
  return result;
};

export const submitMarketReportForm = async (formData) => {
  const result = await apiRequest('/api/market-report', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('market_report', formData);
  return result;
};

export const submitChfaLeadForm = async (formData) => {
  const result = await apiRequest('/api/chfa-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('chfa_schools_to_home', formData);
  return result;
};

export const submitChampionsLeadForm = async (formData) => {
  const result = await apiRequest('/api/champions-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('champions_home_loan', formData);
  return result;
};

export const submitChfaDpaLeadForm = async (formData) => {
  const result = await apiRequest('/api/chfa-dpa-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('chfa_dpa', formData);
  return result;
};

export const submitGhopeLeadForm = async (formData) => {
  const result = await apiRequest('/api/g-hope-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
  trackSuccessfulLead('g_hope_greeley', formData);
  return result;
};

export const adminLogin = async (email, password) => {
  return apiRequest('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const getSubmissions = async (token, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/submissions?${queryString}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getSubmission = async (token, type, id) => {
  return apiRequest(`/api/admin/submissions/${type}/${id}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getStats = async (token) => {
  return apiRequest('/api/admin/stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** Agent cockpit — leads with score / heat / lifecycle / next-touch */
export const getCockpitLeads = async (token, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiRequest(`/api/admin/cockpit?${queryString}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const patchCockpitLead = async (token, id, body) => {
  return apiRequest(`/api/admin/cockpit/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

export const getFubStatus = async (token) => {
  return apiRequest('/api/admin/fub/status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** A/B subject-line open rates for nurture digests */
export const getEmailAbStats = async (token) => {
  return apiRequest('/api/admin/email-ab-stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const getFunnelStats = async (token, days = 30) => {
  return apiRequest(`/api/admin/funnel?days=${encodeURIComponent(days)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Multi-agent seats (P-1) ────────────────────────────────────────────────

export const agentLogin = async (email, password) => {
  return apiRequest('/api/agent/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const getAgentCockpitLeads = async (token, params = {}) => {
  const queryString = new URLSearchParams(params).toString();
  return apiRequest(`/api/agent/cockpit?${queryString}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const patchAgentCockpitLead = async (token, id, body) => {
  return apiRequest(`/api/agent/cockpit/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

export const assignAgentLead = async (token, { user_id, assigned_agent_id }) => {
  return apiRequest('/api/agent/assign', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id, assigned_agent_id }),
  });
};

export const getAgentTeammates = async (token) => {
  return apiRequest('/api/agent/teammates', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** GET /api/agent/me — agent profile + resolved brand (P-2) + marketKey (P-4). */
export const getAgentMe = async (token) => {
  return apiRequest('/api/agent/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** GET /api/agent/market — agent's market pack key + display name (P-4). */
export const getAgentMarket = async (token) => {
  return apiRequest('/api/agent/market', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Connect CRM (P-3a) — per-agent Follow Up Boss ─────────────────────────

/** POST /api/agent/fub/connect { apiKey } — verify + store masked status */
export const connectAgentFub = async (token, apiKey) => {
  return apiRequest('/api/agent/fub/connect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ apiKey }),
  });
};

/** GET /api/agent/fub/status */
export const getAgentFubStatus = async (token) => {
  return apiRequest('/api/agent/fub/status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/agent/fub/disconnect */
export const disconnectAgentFub = async (token) => {
  return apiRequest('/api/agent/fub/disconnect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/agent/fub/import — pull contacts from connected FUB account */
export const importAgentFubContacts = async (token) => {
  return apiRequest('/api/agent/fub/import', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Website forms (P-3b) — capture slug + stats ───────────────────────────

/** GET /api/agent/webform/slug — ensures slug exists */
export const getAgentWebformSlug = async (token) => {
  return apiRequest('/api/agent/webform/slug', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/agent/webform/slug/regenerate */
export const regenerateAgentWebformSlug = async (token) => {
  return apiRequest('/api/agent/webform/slug/regenerate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** GET /api/agent/webform/stats — real webform lead counts */
export const getAgentWebformStats = async (token) => {
  return apiRequest('/api/agent/webform/stats', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const listAgents = async (token) => {
  return apiRequest('/api/admin/agents', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createAgent = async (token, body) => {
  return apiRequest('/api/admin/agents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

export const patchAgent = async (token, id, body) => {
  return apiRequest(`/api/admin/agents/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

export const setAgentDomain = async (token, id, custom_domain) => {
  return apiRequest(`/api/admin/agents/${id}/domain`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ custom_domain }),
  });
};

export const verifyAgentDomain = async (token, id) => {
  return apiRequest(`/api/admin/agents/${id}/domain/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const deleteAgentDomain = async (token, id) => {
  return apiRequest(`/api/admin/agents/${id}/domain`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const resendAgentInvite = async (token, id) => {
  return apiRequest(`/api/admin/agents/${id}/invite`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Account: password reset, invites, two-step sign-in ────────────────────

/** POST /api/account/password-reset/request — always succeeds (never reveals whether the email exists). */
export const requestPasswordReset = async (email) => {
  return apiRequest('/api/account/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

/** GET /api/account/password-reset/check — { purpose: 'reset' | 'invite', email, name, brokerage } */
export const checkPasswordResetToken = async (token) => {
  return apiRequest(`/api/account/password-reset/check?token=${encodeURIComponent(token)}`);
};

/** POST /api/account/password-reset/confirm — { role, email } */
export const confirmPasswordReset = async (token, password) => {
  return apiRequest('/api/account/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
};

/** POST /api/account/2fa/verify — finishes a needs_2fa login; returns the normal login body. */
export const verifyTwoStepLogin = async (challenge, code) => {
  return apiRequest('/api/account/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ challenge, code }),
  });
};

/** GET /api/account/2fa — { enabled, enabled_at } */
export const getTwoStepStatus = async (token) => {
  return apiRequest('/api/account/2fa', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/account/2fa/setup — { secret, otpauth_url, qr_data_url } */
export const setupTwoStep = async (token) => {
  return apiRequest('/api/account/2fa/setup', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/**
 * POST /api/account/2fa/enable — { recovery_codes } (shown once). When the
 * brokerage required two-step sign-in, also { token }: a full token that
 * replaces the setup-only one.
 */
export const enableTwoStep = async (token, code) => {
  return apiRequest('/api/account/2fa/enable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
};

/** POST /api/account/2fa/disable */
export const disableTwoStep = async (token, code) => {
  return apiRequest('/api/account/2fa/disable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });
};

/** GET /api/account/me — { email, name, role, platform, tenant } */
export const getAccountMe = async (token) => {
  return apiRequest('/api/account/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Platform console (platform owner only) ────────────────────────────────

export const listTenants = async (token) => {
  return apiRequest('/api/platform/tenants', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

export const createTenant = async (token, body) => {
  return apiRequest('/api/platform/tenants', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

export const patchTenant = async (token, id, body) => {
  return apiRequest(`/api/platform/tenants/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

/** GET /api/platform/tenants/:id/feeds — listing feeds, service areas, change log */
export const getTenantFeeds = async (token, id) => {
  return apiRequest(`/api/platform/tenants/${id}/feeds`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** PUT /api/platform/tenants/:id/feeds/:key { status, office_mls_id, sold_enabled, notes } */
export const putTenantFeed = async (token, id, key, body) => {
  return apiRequest(`/api/platform/tenants/${id}/feeds/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

/** PUT /api/platform/tenants/:id/service-areas { service_areas } */
export const putTenantServiceAreas = async (token, id, serviceAreas) => {
  return apiRequest(`/api/platform/tenants/${id}/service-areas`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ service_areas: serviceAreas }),
  });
};

// ── Brokerage settings (brokerage owner or platform owner) ────────────────

/** GET /api/admin/settings — brand, lead routing, security, FUB, email, site */
export const getBrokerageSettings = async (token) => {
  return apiRequest('/api/admin/settings', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** PATCH /api/admin/settings — { brand?, lead_visibility?, require_2fa?, fub_api_key? } */
export const patchBrokerageSettings = async (token, body) => {
  return apiRequest('/api/admin/settings', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

/** POST /api/admin/settings/asset/:kind (logo | icon) — { data_url } → { url } */
export const uploadBrokerageAsset = async (token, kind, dataUrl) => {
  return apiRequest(`/api/admin/settings/asset/${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data_url: dataUrl }),
  });
};

/** POST /api/admin/settings/email-domain — { domain } → { data: email } */
export const createBrokerageEmailDomain = async (token, domain) => {
  return apiRequest('/api/admin/settings/email-domain', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ domain }),
  });
};

/** POST /api/admin/settings/email-domain/verify → { data: email } */
export const verifyBrokerageEmailDomain = async (token) => {
  return apiRequest('/api/admin/settings/email-domain/verify', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/admin/settings/domain — { domain } → { data: site } */
export const setBrokerageSiteDomain = async (token, domain) => {
  return apiRequest('/api/admin/settings/domain', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ domain }),
  });
};

/** POST /api/admin/settings/domain/check — refresh DNS/certificate status → { data: site } */
export const checkBrokerageSiteDomain = async (token) => {
  return apiRequest('/api/admin/settings/domain/check', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** POST /api/admin/settings/test-email → { to } */
export const sendBrokerageTestEmail = async (token) => {
  return apiRequest('/api/admin/settings/test-email', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// ── Agent profile ─────────────────────────────────────────────────────────

/** GET /api/agent/profile */
export const getAgentProfile = async (token) => {
  return apiRequest('/api/agent/profile', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

/** PATCH /api/agent/profile — { name, phone, bio, brand_name, brand_phone, title, license_number, notify } */
export const patchAgentProfile = async (token, body) => {
  return apiRequest('/api/agent/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
};

/** POST /api/agent/profile/photo — { data_url } → { url } */
export const uploadAgentPhoto = async (token, dataUrl) => {
  return apiRequest('/api/agent/profile/photo', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data_url: dataUrl }),
  });
};

// ── Public: this brokerage's agents ───────────────────────────────────────

/** GET /api/tenant/agents — active agents of the current brokerage (empty on SAA) */
export const getTenantAgents = async () => {
  return apiRequest('/api/tenant/agents');
};
