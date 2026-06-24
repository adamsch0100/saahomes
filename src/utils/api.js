const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://saahomes-production.up.railway.app' : 'http://localhost:3000');

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
    const data = await response.json();

    if (!response.ok) {
      if (data.errors?.length) {
        throw new Error(data.errors.map((e) => e.msg).join(', '));
      }
      throw new Error(data.error || `HTTP error! status: ${response.status}`);
    }

    return data;
  } catch (error) {
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

