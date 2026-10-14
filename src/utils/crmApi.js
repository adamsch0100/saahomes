/**
 * Cockpit CRM calls (staff token): lead timeline, notes, tasks, texts,
 * emails, reply drafts, tours, texting settings, reports, and hot-lead
 * alerts on this device.
 */
import { pushSupported } from './push.js';

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return '';
})();

async function call(token, method, path, body) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = res.status;
    err.reason = data.reason || null;
    throw err;
  }
  return data.data;
}

export const crm = {
  lead: (t, id) => call(t, 'GET', `/agent/crm/leads/${id}`),
  timeline: (t, id, before) => call(t, 'GET', `/agent/crm/leads/${id}/timeline${before ? `?before=${encodeURIComponent(before)}` : ''}`),
  addNote: (t, id, body) => call(t, 'POST', `/agent/crm/leads/${id}/notes`, body),
  editNote: (t, noteId, body) => call(t, 'PATCH', `/agent/crm/notes/${noteId}`, body),
  deleteNote: (t, noteId) => call(t, 'DELETE', `/agent/crm/notes/${noteId}`),
  addTask: (t, id, body) => call(t, 'POST', `/agent/crm/leads/${id}/tasks`, body),
  editTask: (t, taskId, body) => call(t, 'PATCH', `/agent/crm/tasks/${taskId}`, body),
  deleteTask: (t, taskId) => call(t, 'DELETE', `/agent/crm/tasks/${taskId}`),
  tasks: (t, scope = 'today') => call(t, 'GET', `/agent/crm/tasks?scope=${scope}`),
  texts: (t, id) => call(t, 'GET', `/agent/crm/leads/${id}/texts`),
  sendText: (t, id, body) => call(t, 'POST', `/agent/crm/leads/${id}/texts`, { body }),
  sendEmail: (t, id, subject, body) => call(t, 'POST', `/agent/crm/leads/${id}/emails`, { subject, body }),
  draft: (t, id, channel) => call(t, 'POST', `/agent/crm/leads/${id}/drafts`, { channel }),
  sendDraft: (t, draftId, body, subject) => call(t, 'POST', `/agent/crm/drafts/${draftId}/send`, { body, subject }),
  discardDraft: (t, draftId) => call(t, 'POST', `/agent/crm/drafts/${draftId}/discard`),
  confirmTour: (t, tourId, start) => call(t, 'POST', `/agent/crm/tours/${tourId}/confirm`, { start }),
  smsSettings: (t) => call(t, 'GET', '/admin/settings/sms'),
  saveSmsSettings: (t, body) => call(t, 'PATCH', '/admin/settings/sms', body),
  report: (t, days) => call(t, 'GET', `/admin/reports/agents?days=${days}`),
  teammates: (t) => call(t, 'GET', '/agent/teammates'),
};

/** Download the report CSV (the token can't ride a plain link). */
export async function downloadReportCsv(token, days) {
  const res = await fetch(`${API_BASE}/api/admin/reports/agents?days=${days}&format=csv`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Could not download the report');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agent-report-${days}-days.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Hot-lead alerts on this device, for the signed-in agent. Must run from a tap. */
export async function enableAgentAlerts(token) {
  if (!pushSupported()) throw new Error('This browser can’t show alerts. On iPhone, add this site to your home screen first.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are turned off for this site in your browser settings.');
  const keyRes = await fetch(`${API_BASE}/api/push/key`).then((r) => r.json());
  if (!keyRes.enabled) throw new Error('Alerts aren’t available right now.');
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRes.publicKey) }));
  await call(token, 'POST', '/agent/push/subscribe', { subscription: sub.toJSON() });
  return true;
}

export async function agentAlertsOn() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return !!(reg && (await reg.pushManager.getSubscription()));
}
