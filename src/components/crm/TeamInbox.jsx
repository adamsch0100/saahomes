/**
 * Team inbox: texts and email replies from leads, website forms, Nadia
 * handoffs and new leads from portals, in one list for the team. Claim a
 * conversation, hand it to a teammate, reply by text or email (in the
 * brokerage's brand), and mark it done. Each person sees only the
 * conversations their lead visibility allows.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { crm } from '../../utils/crmApi.js';

const FILTERS = [
  { key: 'open', label: 'Open', count: 'open' },
  { key: 'mine', label: 'Mine', count: 'mine' },
  { key: 'unassigned', label: 'Unassigned', count: 'unassigned' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

const KIND_STYLE = {
  text: 'bg-teal-50 text-teal-800',
  email: 'bg-indigo-50 text-indigo-800',
  nadia: 'bg-fuchsia-50 text-fuchsia-800',
  form: 'bg-amber-50 text-amber-900',
  lead: 'bg-emerald-50 text-emerald-800',
};
const KIND_LABEL = { text: 'Text', email: 'Email', nadia: 'Nadia', form: 'Form', lead: 'New lead' };

// What each empty list means, in plain words, with the one thing to do next.
const EMPTY_COPY = {
  open: 'Nothing waiting. Texts, email replies, form fills and portal leads from your site land here, and you reply from this page.',
  mine: 'Nothing assigned to you. Claim a conversation from Open or Unassigned.',
  unassigned: 'Nothing waiting for a claim. New conversations start here until someone claims them.',
  done: 'Nothing closed yet. Mark a conversation done and it moves here.',
  all: 'No conversations yet. Texts, email replies, form fills and portal leads from your site land here. Share your site link to get the first one.',
};

const btnLight = 'min-h-[40px] px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:border-black disabled:opacity-50';
const btnDark = 'min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50';

const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
const when = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const displayPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};

function Thread({ token, id, teammates, onBack, onChanged, onOpenLead }) {
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState('sms');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendMsg, setSendMsg] = useState(null);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await crm.thread(token, id);
      setT(d);
      setError(null);
      setChannel((c) => (c === 'sms' && !d.texting?.can_text && d.can_email ? 'email' : c));
      setSubject((s) => s || d.reply_subject || '');
    } catch (e) {
      setError(e.message);
    }
  }, [token, id]);
  useEffect(() => { setT(null); setBody(''); setSubject(''); setSendMsg(null); load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [t?.messages?.length]);

  const act = async (action, payload) => {
    setBusy(true);
    setError(null);
    try {
      const d = await crm.threadAction(token, id, action, payload);
      if (d.hidden) { onChanged(); onBack(); return; }
      setT((old) => ({ ...old, ...d }));
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const makeLead = async () => {
    setBusy(true);
    try {
      const r = await crm.threadToLead(token, id);
      onChanged(r.thread_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setSendMsg(null);
    try {
      const d = await crm.reply(token, id, channel, body, channel === 'email' ? subject : undefined);
      setT(d);
      setBody('');
      onChanged();
    } catch (err) {
      setSendMsg(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !t) return <div className="p-4"><button type="button" className={`${btnLight} lg:hidden mb-3`} onClick={onBack}>Back</button><p className="text-sm text-red-700" role="alert">{error}</p></div>;
  if (!t) return <p className="p-4 text-sm text-gray-500">Loading…</p>;
  const canText = !!t.texting?.can_text;
  return (
    <div className="flex flex-col h-full min-h-[480px]">
      <div className="border-b border-gray-200 p-3 sm:p-4">
        <div className="flex items-start gap-2">
          <button type="button" className={`${btnLight} lg:hidden`} onClick={onBack} aria-label="Back to the inbox">Back</button>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 truncate">{t.name}</h3>
            <p className="text-sm text-gray-600 break-all">
              {t.phone && <a href={`tel:${t.phone}`} className="underline mr-3">{displayPhone(t.phone)}</a>}
              {t.email && <a href={`mailto:${t.email}`} className="underline">{t.email}</a>}
            </p>
          </div>
          {t.status === 'open'
            ? <button type="button" className={btnLight} disabled={busy} onClick={() => act('done')}>Mark done</button>
            : <button type="button" className={btnLight} disabled={busy} onClick={() => act('reopen')}>Reopen</button>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {t.lead_id
            ? <button type="button" className={btnLight} onClick={() => onOpenLead(t.lead_id)}>Open lead</button>
            : <button type="button" className={btnLight} disabled={busy} onClick={makeLead}>Add as a lead</button>}
          {!t.assignee_id && <button type="button" className={btnLight} disabled={busy} onClick={() => act('claim')}>Claim</button>}
          <label className="sr-only" htmlFor={`assign-${t.id}`}>Assigned to</label>
          <select id={`assign-${t.id}`} value={t.assignee_id || ''} disabled={busy} onChange={(e) => act('assign', { agent_id: e.target.value ? Number(e.target.value) : null })}
            className="min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm bg-white max-w-[12rem]">
            <option value="">Unassigned</option>
            {teammates.map((m) => <option key={m.id} value={m.id}>{m.name || m.email}</option>)}
          </select>
        </div>
        {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
      </div>

      <ol className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50">
        {t.messages.map((m) => {
          const out = m.direction === 'out';
          return (
            <li key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${out ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                <p className={`text-[11px] font-semibold mb-0.5 ${out ? 'text-gray-300' : 'text-gray-500'}`}>
                  {m.kind_label}{out && m.agent_name ? ` · ${m.agent_name}` : ''} · {when(m.at)}
                  {m.status === 'failed' ? ' · didn’t send' : ''}
                </p>
                {m.subject && <p className="font-semibold">{m.subject}</p>}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
        <li ref={endRef} aria-hidden="true" />
      </ol>

      <form onSubmit={send} className="border-t border-gray-200 p-3 sm:p-4 space-y-2">
        {!t.lead_id ? (
          <p className="text-sm text-gray-600">Add this person as a lead to reply from here.</p>
        ) : (
          <>
            <div className="flex gap-1" role="radiogroup" aria-label="Reply by">
              {[['sms', 'Text'], ['email', 'Email']].map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={channel === k} onClick={() => setChannel(k)}
                  className={`min-h-[36px] px-3 rounded-full text-sm font-semibold ${channel === k ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
              ))}
            </div>
            {channel === 'sms' && !canText && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-2 py-1">{t.texting?.message || 'Texting isn’t available for this person.'}</p>}
            {channel === 'email' && !t.can_email && <p className="text-xs text-amber-900 bg-amber-50 rounded-lg px-2 py-1">There’s no email address for this person.</p>}
            {channel === 'email' && (
              <>
                <label className="sr-only" htmlFor={`subj-${t.id}`}>Subject</label>
                <input id={`subj-${t.id}`} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm" maxLength={160} />
              </>
            )}
            <label className="sr-only" htmlFor={`reply-${t.id}`}>Your reply</label>
            <textarea id={`reply-${t.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder={channel === 'sms' ? 'Write a text…' : 'Write an email…'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" maxLength={channel === 'sms' ? 1200 : 10000} />
            {sendMsg && <p className="text-sm text-red-700" role="alert">{sendMsg}</p>}
            <div className="flex justify-end">
              <button type="submit" className={btnDark} disabled={busy || !body.trim() || (channel === 'sms' ? !canText : !t.can_email)}>
                {busy ? 'Sending…' : channel === 'sms' ? 'Send text' : 'Send email'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

export default function TeamInbox({ token, onOpenLead, onCounts }) {
  const [filter, setFilter] = useState('open');
  const [q, setQ] = useState('');
  const [threads, setThreads] = useState(null);
  const [counts, setCounts] = useState(null);
  const [active, setActive] = useState(null);
  const [error, setError] = useState(null);
  const [teammates, setTeammates] = useState([]);

  const load = useCallback(async () => {
    try {
      const d = await crm.inbox(token, filter, q.trim());
      setThreads(d.threads);
      setCounts(d.counts);
      onCounts?.(d.counts);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token, filter, q, onCounts]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);
  useEffect(() => {
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);
  useEffect(() => {
    crm.teammates(token).then(setTeammates).catch(() => setTeammates([]));
  }, [token]);

  const changed = (moveTo) => {
    if (moveTo) setActive(moveTo);
    load();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:divide-x divide-gray-200 min-h-[560px]">
        <div className={`${active ? 'hidden lg:flex' : 'flex'} flex-col min-w-0`}>
          <div className="p-3 border-b border-gray-200 space-y-2">
            <label className="sr-only" htmlFor="inbox-search">Search the inbox</label>
            <input id="inbox-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone…"
              className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Show">
              {FILTERS.map((f) => (
                <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                  className={`shrink-0 min-h-[36px] px-3 rounded-full text-sm font-semibold ${filter === f.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                  {f.label}{f.count && counts?.[f.count] ? <span className="ml-1 opacity-75">{counts[f.count]}</span> : null}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="p-3 text-sm text-red-700" role="alert">{error}</p>}
          {!threads && !error && <p className="p-4 text-sm text-gray-500">Loading…</p>}
          {threads && threads.length === 0 && (
            <p className="p-6 text-sm text-gray-500 text-center">
              {q.trim()
                ? 'No conversations match that search.'
                : EMPTY_COPY[filter] || EMPTY_COPY.all}
            </p>
          )}
          {threads && threads.length > 0 && (
            <ul className="divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
              {threads.map((th) => (
                <li key={th.id}>
                  <button type="button" onClick={() => setActive(th.id)}
                    className={`w-full text-left px-3 py-3 min-h-[64px] hover:bg-gray-50 ${active === th.id ? 'bg-gray-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      {th.unread && <span className="w-2 h-2 rounded-full bg-[color:var(--brand-accent,#111)] shrink-0" aria-label="Unread" />}
                      <span className={`truncate text-sm ${th.unread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>{th.name}</span>
                      <span className="ml-auto text-xs text-gray-400 shrink-0">{ago(th.last_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      {th.last_kind && <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${KIND_STYLE[th.last_kind] || 'bg-gray-100 text-gray-700'}`}>{KIND_LABEL[th.last_kind] || th.last_kind}</span>}
                      <span className="truncate text-xs text-gray-600">{th.preview}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-400">{th.assignee_name ? `With ${th.assignee_name}` : 'Unassigned'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={`${active ? 'block' : 'hidden lg:block'} min-w-0`}>
          {active
            ? <Thread key={active} token={token} id={active} teammates={teammates} onBack={() => setActive(null)} onChanged={changed} onOpenLead={onOpenLead} />
            : <p className="hidden lg:block p-8 text-sm text-gray-500 text-center">{threads && threads.length === 0 ? 'A conversation opens here once one comes in.' : 'Pick a conversation.'}</p>}
        </div>
      </div>
    </div>
  );
}
