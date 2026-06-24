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
  return apiRequest('/api/contact', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
};

export const submitMarketReportForm = async (formData) => {
  return apiRequest('/api/market-report', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
};

export const submitChfaLeadForm = async (formData) => {
  return apiRequest('/api/chfa-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
};

export const submitChampionsLeadForm = async (formData) => {
  return apiRequest('/api/champions-lead', {
    method: 'POST',
    body: JSON.stringify(formData),
  });
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
