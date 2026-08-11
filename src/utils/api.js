import { trackLeadConversion } from './analytics.js';

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

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
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
      if (data?.errors?.length) {
        throw new Error(data.errors.map((e) => e.msg).join(', '));
      }
      throw new Error(data?.error || `Request failed (${response.status}). Please call (970) 999-1407.`);
    }

    return data;
  } catch (error) {
    if (error.name === 'TypeError') {
      throw new Error('Unable to reach our servers. Please call (970) 999-1407 or email info@saahomes.com.');
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
