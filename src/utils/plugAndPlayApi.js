/**
 * API calls for signup (/start), first-run setup, billing and embeds.
 * Signup uses its own small request helper so its errors never carry a
 * brokerage's phone number; the owner console uses apiRequest like the rest.
 */
import { apiRequest } from './api.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });

async function plainRequest(path, options = {}) {
  let res;
  try {
    res = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new Error('We couldn’t reach the server. Check your connection and try again.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const err = new Error(data?.error || 'Something went wrong. Please try again.');
    err.field = data?.field || null;
    err.status = res.status;
    throw err;
  }
  return data;
}

// ── signup (public, platform site only) ──
export const getSignupInfo = () => plainRequest('/api/signup/info');
export const checkSignupSlug = (slug) => plainRequest(`/api/signup/check?slug=${encodeURIComponent(slug)}`);
export const submitSignup = (body) => plainRequest('/api/signup', { method: 'POST', body: JSON.stringify(body) });

// ── setup (owner) ──
export const getOwnerSetup = (token) => apiRequest('/api/admin/setup', { headers: auth(token) });
export const patchOwnerSetup = (token, body) =>
  apiRequest('/api/admin/setup', { method: 'PATCH', headers: auth(token), body: JSON.stringify(body) });
export const confirmOwnerEmail = (confirmToken) =>
  apiRequest('/api/admin/setup/confirm-email', { method: 'POST', body: JSON.stringify({ token: confirmToken }) });
export const resendOwnerConfirm = (token) =>
  apiRequest('/api/admin/setup/resend-confirm', { method: 'POST', headers: auth(token) });

// ── billing (owner) ──
export const getOwnerBilling = (token) => apiRequest('/api/admin/billing', { headers: auth(token) });
export const startBillingCheckout = (token) =>
  apiRequest('/api/admin/billing/checkout', { method: 'POST', headers: auth(token) });
export const openBillingPortal = (token) =>
  apiRequest('/api/admin/billing/portal', { method: 'POST', headers: auth(token) });

// ── embeds (owner) ──
export const getOwnerEmbeds = (token) => apiRequest('/api/admin/embeds', { headers: auth(token) });
