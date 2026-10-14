/**
 * Agent profile (agent console): photo, name, title, phone, bio, license
 * number, the brand name/phone buyers see, and which notifications to get.
 * GET/PATCH /api/agent/profile, POST /api/agent/profile/photo.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getAgentProfile, patchAgentProfile, uploadAgentPhoto } from '../../utils/api.js';
import { readImageAsDataUrl } from '../../utils/imageUpload.js';

const GOLD = 'var(--brand-accent)';

const FIELDS = [
  { key: 'name', label: 'Name', placeholder: 'Jordan Smith' },
  { key: 'title', label: 'Title', placeholder: 'Broker Associate' },
  { key: 'phone', label: 'Phone', placeholder: '(555) 555-0100', type: 'tel' },
  { key: 'license_number', label: 'License number', placeholder: 'FA.100000000' },
  {
    key: 'brand_name',
    label: 'Brand name on your emails',
    placeholder: 'Leave empty to use the brokerage name',
    hint: 'Optional. Your team or personal brand.',
  },
  {
    key: 'brand_phone',
    label: 'Phone on your emails',
    placeholder: 'Leave empty to use your phone',
    type: 'tel',
  },
];

const NOTIFY = [
  { key: 'new_lead_email', label: 'Email me when I get a new lead' },
  { key: 'hot_lead_push', label: 'Push alert when a lead turns hot' },
  { key: 'morning_brief', label: 'Morning brief: who to call today' },
];

const inputClass =
  'mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';

function formFrom(p) {
  return {
    name: p?.name || '',
    title: p?.title || '',
    phone: p?.phone || '',
    license_number: p?.license_number || '',
    brand_name: p?.brand_name || '',
    brand_phone: p?.brand_phone || '',
    bio: p?.bio || '',
    notify: {
      new_lead_email: !!p?.notify?.new_lead_email,
      hot_lead_push: !!p?.notify?.hot_lead_push,
      morning_brief: !!p?.notify?.morning_brief,
    },
  };
}

export default function AgentProfile({ token, onSaved }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(formFrom(null));
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [note, setNote] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setNote(null);
    try {
      const res = await getAgentProfile(token);
      setProfile(res.data || {});
      setForm(formFrom(res.data));
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Could not load your profile' });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const body = { notify: form.notify };
      for (const k of ['name', 'title', 'phone', 'license_number', 'brand_name', 'brand_phone', 'bio']) {
        const v = String(form[k] || '').trim();
        body[k] = v || null;
      }
      const res = await patchAgentProfile(token, body);
      setProfile(res.data || profile);
      setForm(formFrom(res.data || profile));
      setNote({ kind: 'ok', text: 'Saved.' });
      if (onSaved) onSaved(res.data);
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (file) => {
    setPhotoBusy(true);
    setNote(null);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const res = await uploadAgentPhoto(token, dataUrl);
      setProfile((p) => ({ ...(p || {}), photo_url: res.url || p?.photo_url }));
      setNote({ kind: 'ok', text: 'Photo updated.' });
    } catch (err) {
      setNote({ kind: 'error', text: err.message || 'Upload failed' });
    } finally {
      setPhotoBusy(false);
    }
  };

  if (!profile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        {loading ? (
          <div className="h-32 rounded-lg bg-gray-100 animate-pulse" aria-busy="true" />
        ) : note?.kind === 'error' ? (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
            {note.text}
            <button type="button" onClick={load} className="ml-3 underline">
              Try again
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const initials = String(form.name || profile.email || '?')
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Your profile</h2>
        <p className="text-sm text-gray-500 mt-1">
          Buyers see this on the website and in the emails they get from you.
          {profile.email ? ` Signed in as ${profile.email}.` : ''}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-20 w-20 shrink-0 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={form.name || 'Your photo'} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-gray-400">{initials}</span>
          )}
        </div>
        <label className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black inline-flex items-center cursor-pointer">
          {photoBusy ? 'Uploading…' : profile.photo_url ? 'Change photo' : 'Add a photo'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={photoBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) uploadPhoto(file);
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-xs font-medium text-gray-600">{f.label}</span>
            <input
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={(e) => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={inputClass}
            />
            {f.hint ? <span className="text-xs text-gray-400">{f.hint}</span> : null}
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-600">Bio</span>
          <textarea
            rows={4}
            value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
            placeholder="A few lines about you and how you help buyers and sellers."
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs font-medium text-gray-600">Notifications</legend>
        <div className="mt-2 space-y-2">
          {NOTIFY.map((n) => (
            <label key={n.key} className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={form.notify[n.key]}
                onChange={(e) => setForm((f) => ({ ...f, notify: { ...f.notify, [n.key]: e.target.checked } }))}
                className="h-4 w-4 accent-[color:var(--brand-accent)]"
              />
              {n.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] disabled:opacity-50"
          style={{ backgroundColor: GOLD }}
        >
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        {note ? (
          <span className={`text-sm ${note.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>{note.text}</span>
        ) : null}
      </div>
    </form>
  );
}
