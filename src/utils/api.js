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
