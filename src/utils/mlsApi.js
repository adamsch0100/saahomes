/**
 * API calls for "Connect your MLS" (brokerage owner) and the platform
 * console's MLS connections. Secrets go up, never come back: responses only
 * carry "saved, ending in …" hints.
 */
import { apiRequest } from './api.js';

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const send = (token, method, path, body) =>
  apiRequest(path, { method, headers: auth(token), ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const k = (key) => encodeURIComponent(key);

// ── owner ──
export const searchMlsCatalog = (token, q = '') => apiRequest(`/api/admin/mls/catalog?q=${encodeURIComponent(q)}`, { headers: auth(token) });
export const getMlsConnect = (token) => apiRequest('/api/admin/mls/connect', { headers: auth(token) });
export const startMlsConnect = (token, body) => send(token, 'POST', '/api/admin/mls/connect', body);
export const patchMlsConnect = (token, key, body) => send(token, 'PATCH', `/api/admin/mls/connect/${k(key)}`, body);
export const saveMlsCredentials = (token, key, body) => send(token, 'PUT', `/api/admin/mls/connect/${k(key)}/credentials`, body);
export const testMlsConnect = (token, key) => send(token, 'POST', `/api/admin/mls/connect/${k(key)}/test`, {});
export const goLiveMls = (token, key) => send(token, 'POST', `/api/admin/mls/connect/${k(key)}/go-live`, { attest: true });
export const cancelMlsConnect = (token, key) => send(token, 'DELETE', `/api/admin/mls/connect/${k(key)}`);

// ── platform owner ──
export const listMlsConnections = (token) => apiRequest('/api/platform/mls/connections', { headers: auth(token) });
export const searchPlatformCatalog = (token, q = '') => apiRequest(`/api/platform/mls/catalog?q=${encodeURIComponent(q)}`, { headers: auth(token) });
export const createMlsConnection = (token, body) => send(token, 'POST', '/api/platform/mls/connections', body);
export const patchMlsConnection = (token, key, body) => send(token, 'PATCH', `/api/platform/mls/connections/${k(key)}`, body);
export const saveConnectionCredentials = (token, key, body) => send(token, 'PUT', `/api/platform/mls/connections/${k(key)}/credentials`, body);
export const testMlsConnection = (token, key) => send(token, 'POST', `/api/platform/mls/connections/${k(key)}/test`, {});
export const syncMlsConnection = (token, key, mode = 'auto') => send(token, 'POST', `/api/platform/mls/connections/${k(key)}/sync`, { mode });
export const setBrokerageFeed = (token, tenantId, key, body) => send(token, 'PUT', `/api/platform/tenants/${tenantId}/feeds/${k(key)}`, body);
