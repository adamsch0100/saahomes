/**
 * One lead, everything in one place: what they did on the site, alerts,
 * saved homes, reactions, tours, texts, emails, notes and tasks in one
 * scrollable timeline, plus quick actions (stage, text, email, note, task)
 * and Nadia's reply drafts, which only go out when the agent presses Send.
 * Opens as a side panel on desktop and full screen on a phone.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { crm } from '../../utils/crmApi.js';
import { createPortal } from 'react-dom';

const STAGES = [
  { value: 'new', label: 'New' },
  { value: 'nurturing', label: 'Nurturing' },
  { value: 'showing', label: 'Showing' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
  { value: 'lost', label: 'Lost' },
];

const TASK_KINDS = [
  { value: 'call', label: 'Call' },
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'follow_up', label: 'Follow up' },
  { value: 'showing', label: 'Showing' },
];

const KIND_DOT = {
  view: 'bg-sky-400',
  search: 'bg-sky-300',
  save: 'bg-rose-400',
  reaction: 'bg-rose-300',
  tour: 'bg-emerald-500',
  seller: 'bg-orange-400',
  alert: 'bg-violet-400',
  text: 'bg-teal-500',
  email: 'bg-indigo-400',
  note: 'bg-amber-400',
  call: 'bg-amber-500',
  task: 'bg-gray-500',
  hot: 'bg-red-500',
  nadia: 'bg-fuchsia-400',
  consent: 'bg-gray-400',
  fub: 'bg-gray-400',
};

const inputClass = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black';
const btnDark = 'min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50';
const btnLight = 'min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:border-black disabled:opacity-50';
const btnAccent = 'min-h-[44px] px-4 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] bg-[color:var(--brand-accent)] hover:opacity-90 disabled:opacity-50';

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
};
const timeLabel = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const whenLabel = (iso) => (iso ? `${dayLabel(iso)}, ${timeLabel(iso)}` : '');
const displayPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const localInput = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (d < new Date()) d.setHours(20, 0, 0, 0);
  return d;
};

function Note({ kind = 'info', children }) {
  if (!children) return null;
  const cls = kind === 'error' ? 'bg-red-50 border-red-200 text-red-800' : kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gray-50 border-gray-200 text-gray-700';
  return <p className={`text-sm border rounded-lg px-3 py-2 ${cls}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>;
}

/** Confirm a tour time from the timeline. */
function TourConfirm({ token, tour, onDone }) {
  const [start, setStart] = useState(() => {
    const w = Array.isArray(tour.windows) ? tour.windows[0] : null;
    const hour = { morning: 10, midday: 12, afternoon: 14, evening: 17 }[w?.part] || 10;
    const d = w?.date ? new Date(`${w.date}T${String(hour).padStart(2, '0')}:00:00`) : new Date(Date.now() + 86400000);
    return localInput(d);
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  if (tour.status === 'confirmed' && tour.confirmed_start) {
    return <p className="mt-1 text-xs font-semibold text-emerald-700">Confirmed for {whenLabel(tour.confirmed_start)}</p>;
  }
  const confirm = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await crm.confirmTour(token, tour.id, new Date(start).toISOString());
      setMsg({ kind: 'ok', text: `Confirmed. ${r.text_note || ''}` });
      onDone?.();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`tour-${tour.id}`}>Tour time</label>
      <input id={`tour-${tour.id}`} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm" />
      <button type="button" onClick={confirm} disabled={busy} className="min-h-[40px] px-3 rounded-lg bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50">
        {busy ? 'Confirming…' : 'Confirm tour'}
      </button>
      {msg && <span className={`text-xs ${msg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{msg.text}</span>}
    </div>
  );
}

function Timeline({ token, leadId, items, onMore, moreBusy, hasMore, onChanged }) {
  if (!items.length) return <p className="text-sm text-gray-500 py-6 text-center">Nothing yet. Activity shows up here as it happens.</p>;
  let lastDay = null;
  return (
    <div>
      <ol className="relative">
        {items.map((it) => {
          const day = dayLabel(it.at);
          const header = day !== lastDay ? day : null;
          lastDay = day;
          return (
            <React.Fragment key={it.id}>
              {header && <li className="pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{header}</li>}
              <li className="flex gap-3 py-2">
                <span className={`mt-1.5 shrink-0 w-2.5 h-2.5 rounded-full ${KIND_DOT[it.kind] || 'bg-gray-300'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900">
                    {it.link ? <a href={it.link} target="_blank" rel="noreferrer" className="hover:underline">{it.title}</a> : it.title}
                    {it.pinned && <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">Pinned</span>}
                    {it.in_fub && <span className="ml-1.5 text-[10px] text-gray-400">in FUB</span>}
                  </p>
                  {it.detail && <p className={`text-sm mt-0.5 whitespace-pre-line break-words ${it.kind === 'text' || it.kind === 'email' || it.kind === 'note' || it.kind === 'call' ? 'text-gray-700 bg-gray-50 rounded-lg px-3 py-2' : 'text-gray-500'}`}>{it.detail}</p>}
                  {it.status === 'failed' && <p className="text-xs text-red-700 mt-0.5">Didn’t go through</p>}
                  {it.tour && <TourConfirm token={token} tour={it.tour} onDone={onChanged} />}
                  <p className="text-[11px] text-gray-400 mt-0.5">{timeLabel(it.at)}</p>
                </div>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
      {hasMore && (
        <div className="py-3 text-center">
          <button type="button" onClick={onMore} disabled={moreBusy} className={btnLight}>{moreBusy ? 'Loading…' : 'Show older'}</button>
        </div>
      )}
    </div>
  );
}

function NotesTab({ token, leadId, notes, onChanged }) {
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [kind, setKind] = useState('note');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editBody, setEditBody] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await crm.addNote(token, leadId, { body, pinned, kind });
      setBody('');
      setPinned(false);
      setKind('note');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const act = async (fn) => {
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-2">
        <label htmlFor="note-body" className="sr-only">New note</label>
        <textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="What did you learn? Budget, timing, must-haves…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px]">
            <input type="checkbox" checked={kind === 'call'} onChange={(e) => setKind(e.target.checked ? 'call' : 'note')} className="w-4 h-4" />
            This was a call
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px]">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} className="w-4 h-4" />
            Pin to top
          </label>
          <button type="submit" disabled={busy || !body.trim()} className={`${btnDark} ml-auto`}>{busy ? 'Saving…' : 'Save note'}</button>
        </div>
      </form>
      <Note kind="error">{error}</Note>
      {notes.length === 0 ? (
        <p className="text-sm text-gray-500">No notes yet.</p>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg border p-3 ${n.pinned ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 bg-white'}`}>
              {editing === n.id ? (
                <div className="space-y-2">
                  <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" aria-label="Edit note" />
                  <div className="flex gap-2">
                    <button type="button" className={btnDark} onClick={() => act(async () => { await crm.editNote(token, n.id, { body: editBody }); setEditing(null); })}>Save</button>
                    <button type="button" className={btnLight} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-900 whitespace-pre-line break-words">{n.body}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {n.kind === 'call' ? 'Call · ' : ''}{n.author_name || 'Teammate'} · {whenLabel(n.created_at)}
                    {n.updated_at ? ` · edited${n.edited_by_name ? ` by ${n.edited_by_name}` : ''}` : ''}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:border-black" onClick={() => act(() => crm.editNote(token, n.id, { pinned: !n.pinned }))}>
                      {n.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {n.can_edit && (
                      <>
                        <button type="button" className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:border-black" onClick={() => { setEditing(n.id); setEditBody(n.body); }}>Edit</button>
                        <button type="button" className="min-h-[36px] px-3 rounded-lg border border-gray-300 text-xs font-medium text-red-700 hover:border-red-700" onClick={() => { if (window.confirm('Delete this note?')) act(() => crm.deleteNote(token, n.id)); }}>Delete</button>
                      </>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TasksTab({ token, leadId, tasks, teammates: given, currentAgentId, onChanged }) {
  const [teammates, setTeammates] = useState(given);
  useEffect(() => {
    if (given.length) return;
    crm.teammates(token).then(setTeammates).catch(() => {});
  }, [token, given]);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('call');
  const [due, setDue] = useState(() => localInput(endOfToday()));
  const [remind, setRemind] = useState(true);
  const [assignee, setAssignee] = useState(currentAgentId ? String(currentAgentId) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const add = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const dueIso = due ? new Date(due).toISOString() : null;
      await crm.addTask(token, leadId, {
        title, kind, due_at: dueIso,
        remind_at: remind && dueIso ? new Date(new Date(due).getTime() - 15 * 60000).toISOString() : null,
        ...(assignee ? { assignee_id: Number(assignee) } : {}),
      });
      setTitle('');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const toggle = async (t) => {
    try {
      await crm.editTask(token, t.id, { done: !t.done_at });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };
  const open = tasks.filter((t) => !t.done_at);
  const done = tasks.filter((t) => t.done_at);
  const overdue = (t) => t.due_at && new Date(t.due_at) < new Date();

  return (
    <div className="space-y-4">
      <form onSubmit={add} className="space-y-2 rounded-lg border border-gray-200 p-3 bg-gray-50">
        <label htmlFor="task-title" className="text-xs font-medium text-gray-600">New task</label>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Call about Saturday showings" className={inputClass} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs font-medium text-gray-600">Type
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${inputClass} mt-1 bg-white`}>
              {TASK_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">Due
            <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={`${inputClass} mt-1`} />
          </label>
          <label className="text-xs font-medium text-gray-600">For
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={`${inputClass} mt-1 bg-white`}>
              {!teammates.some((t) => Number(t.id) === Number(currentAgentId)) && <option value="">Me</option>}
              {teammates.map((t) => <option key={t.id} value={t.id}>{Number(t.id) === Number(currentAgentId) ? 'Me' : t.name || t.email}</option>)}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[44px]">
            <input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} className="w-4 h-4" />
            Remind me 15 minutes before
          </label>
          <button type="submit" disabled={busy || !title.trim()} className={`${btnDark} ml-auto`}>{busy ? 'Adding…' : 'Add task'}</button>
        </div>
      </form>
      <Note kind="error">{error}</Note>
      {open.length === 0 && done.length === 0 && <p className="text-sm text-gray-500">No tasks yet.</p>}
      <ul className="divide-y divide-gray-100">
        {[...open, ...done].map((t) => (
          <li key={t.id} className="flex items-start gap-3 py-2">
            <input type="checkbox" checked={!!t.done_at} onChange={() => toggle(t)} className="mt-1 w-5 h-5 shrink-0" aria-label={`Mark “${t.title}” ${t.done_at ? 'not done' : 'done'}`} />
            <div className="min-w-0">
              <p className={`text-sm ${t.done_at ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</p>
              <p className={`text-xs ${!t.done_at && overdue(t) ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
                {TASK_KINDS.find((k) => k.value === t.kind)?.label || 'Task'}
                {t.due_at ? ` · due ${whenLabel(t.due_at)}` : ''}
                {!t.done_at && overdue(t) ? ' · overdue' : ''}
                {t.assignee_name ? ` · ${t.assignee_name}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The text thread plus a composer, with Nadia's draft as an editable start. */
function TextsTab({ token, lead, onSent }) {
  const [thread, setThread] = useState(null);
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState(null);
  const endRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setThread(await crm.texts(token, lead.id));
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    }
  }, [token, lead.id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [thread]);

  const makeDraft = async () => {
    setDrafting(true);
    setMsg(null);
    try {
      const d = await crm.draft(token, lead.id, 'sms');
      setDraft(d);
      setBody(d.body);
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setDrafting(false);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (draft) await crm.sendDraft(token, draft.id, body);
      else await crm.sendText(token, lead.id, body);
      setBody('');
      setDraft(null);
      await load();
      onSent?.();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const texting = thread?.texting;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 min-h-[160px] max-h-[50vh] overflow-y-auto">
        {!thread ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : thread.messages.length === 0 ? (
          <p className="text-sm text-gray-500">No texts yet.</p>
        ) : (
          <ul className="space-y-2">
            {thread.messages.map((m) => (
              <li key={m.id} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.direction === 'out' ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'}`}>
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p className={`text-[10px] mt-1 ${m.direction === 'out' ? 'text-gray-300' : 'text-gray-400'}`}>
                    {whenLabel(m.created_at)}
                    {m.direction === 'out' && m.kind !== 'conversation' ? ` · ${m.kind === 'alert' ? 'alert' : 'automatic'}` : ''}
                    {m.direction === 'out' && m.agent_name ? ` · ${m.agent_name}` : ''}
                    {m.status === 'failed' ? ' · didn’t go through' : m.status === 'delivered' ? ' · delivered' : ''}
                  </p>
                </div>
              </li>
            ))}
            <li ref={endRef} />
          </ul>
        )}
      </div>
      {texting && !texting.can_text && <Note>{texting.message}</Note>}
      <form onSubmit={send} className="space-y-2">
        {draft && (
          <p className="text-xs text-[color:var(--brand-accent-text)] font-semibold">
            Drafted by Nadia{draft.source === 'template' ? ' (a starting point)' : ''}. Edit it, then press Send. Nothing goes out until you do.
          </p>
        )}
        <label htmlFor="text-body" className="sr-only">Text message</label>
        <textarea id="text-body" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={600} disabled={texting && !texting.can_text && texting.reason !== 'quiet_hours'} placeholder={`Text ${lead.name?.split(' ')[0] || 'them'}…`} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100" />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={makeDraft} disabled={drafting} className={btnLight}>{drafting ? 'Drafting…' : 'Draft with Nadia'}</button>
          {draft && <button type="button" onClick={() => { crm.discardDraft(token, draft.id).catch(() => {}); setDraft(null); setBody(''); }} className="min-h-[44px] px-3 text-sm text-gray-600 underline">Discard draft</button>}
          <span className="ml-auto text-[11px] text-gray-400">{body.length}/600</span>
          <button type="submit" disabled={busy || !body.trim() || (texting && !texting.can_text)} className={btnAccent}>{busy ? 'Sending…' : 'Send text'}</button>
        </div>
      </form>
      <Note kind={msg?.kind}>{msg?.text}</Note>
    </div>
  );
}

function EmailComposer({ token, lead, onClose, onSent }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState(null);
  const makeDraft = async () => {
    setDrafting(true);
    setMsg(null);
    try {
      const d = await crm.draft(token, lead.id, 'email');
      setDraft(d);
      setSubject(d.subject || '');
      setBody(d.body);
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setDrafting(false);
    }
  };
  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (draft) await crm.sendDraft(token, draft.id, body, subject);
      else await crm.sendEmail(token, lead.id, subject, body);
      onSent?.();
      onClose();
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={send} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">Email {lead.name || lead.email}</p>
        <button type="button" onClick={onClose} className="min-h-[36px] px-2 text-sm text-gray-500">Close</button>
      </div>
      {draft && <p className="text-xs text-[color:var(--brand-accent-text)] font-semibold">Drafted by Nadia{draft.source === 'template' ? ' (a starting point)' : ''}. Edit it, then press Send.</p>}
      <label htmlFor="email-subject" className="sr-only">Subject</label>
      <input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={inputClass} />
      <label htmlFor="email-body" className="sr-only">Message</label>
      <textarea id="email-body" value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Write your email…" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black" />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={makeDraft} disabled={drafting} className={btnLight}>{drafting ? 'Drafting…' : 'Draft with Nadia'}</button>
        <button type="submit" disabled={busy || !body.trim()} className={`${btnAccent} ml-auto`}>{busy ? 'Sending…' : 'Send email'}</button>
      </div>
      <Note kind={msg?.kind}>{msg?.text}</Note>
    </form>
  );
}

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'texts', label: 'Texts' },
];

export default function LeadPanel({ token, leadId, onClose, onPatch, teammates = [], currentAgentId = null, initialTab = 'timeline' }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(TABS.some((t) => t.key === initialTab) ? initialTab : 'timeline');
  const [timeline, setTimeline] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [stageBusy, setStageBusy] = useState(false);
  const closeRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const d = await crm.lead(token, leadId);
      setData(d);
      setTimeline(d.timeline);
      setHasMore(d.timeline.length >= 80);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token, leadId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const more = async () => {
    setMoreBusy(true);
    try {
      const older = await crm.timeline(token, leadId, timeline[timeline.length - 1]?.at);
      setTimeline((t) => [...t, ...older.filter((o) => !t.some((x) => x.id === o.id))]);
      setHasMore(older.length >= 80);
    } catch (e) {
      setError(e.message);
    } finally {
      setMoreBusy(false);
    }
  };

  const changeStage = async (stage) => {
    setStageBusy(true);
    try {
      await onPatch?.(leadId, { lifecycle_stage: stage });
      setData((d) => ({ ...d, lead: { ...d.lead, lifecycle_stage: stage } }));
    } finally {
      setStageBusy(false);
    }
  };

  const lead = data?.lead;
  const pinned = (data?.notes || []).filter((n) => n.pinned);
  const openTasks = (data?.tasks || []).filter((t) => !t.done_at).length;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="lead-panel-title">
      <button type="button" className="absolute inset-0 bg-black/40 cursor-default" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div className="relative w-full sm:max-w-xl lg:max-w-2xl h-full bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="lead-panel-title" className="text-xl font-bold text-gray-900 truncate">{lead?.name || lead?.email || 'Lead'}</h2>
              {lead && (
                <p className="text-sm text-gray-600 mt-0.5 break-all">
                  {lead.phone && <a href={`tel:${lead.phone_e164 || lead.phone}`} className="underline mr-3">{displayPhone(lead.phone)}</a>}
                  <a href={`mailto:${lead.email}`} className="underline">{lead.email}</a>
                </p>
              )}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} className="shrink-0 min-h-[44px] min-w-[44px] rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black">Close</button>
          </div>
          {lead && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="lead-stage">Stage</label>
              <select id="lead-stage" value={lead.lifecycle_stage || 'new'} disabled={stageBusy} onChange={(e) => changeStage(e.target.value)} className="min-h-[40px] rounded-full border border-gray-300 bg-white px-3 text-sm font-semibold">
                {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              {data.consent.sms === 'granted' && <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 px-2 py-1 rounded-full">OK to text</span>}
              {data.consent.sms === 'revoked' && <span className="text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-1 rounded-full">Texts off</span>}
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" className={btnLight} onClick={() => setTab('texts')}>Text</button>
                <button type="button" className={btnLight} onClick={() => setEmailOpen((v) => !v)}>Email</button>
                <button type="button" className={btnAccent} onClick={() => { if (lead.phone && data.texting.can_text) setTab('texts'); else setEmailOpen(true); }}>Draft a reply</button>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {error && <div className="mt-4"><Note kind="error">{error}</Note></div>}
          {!data && !error && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
          {data && (
            <>
              {emailOpen && <div className="mt-4"><EmailComposer token={token} lead={lead} onClose={() => setEmailOpen(false)} onSent={load} /></div>}
              {pinned.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {pinned.map((n) => (
                    <li key={n.id} className="rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2 text-sm text-gray-900">
                      <span className="text-[10px] font-bold uppercase text-amber-800 mr-1.5">Pinned</span>{n.body}
                    </li>
                  ))}
                </ul>
              )}
              <div className="sticky top-0 bg-white z-10 mt-3 border-b border-gray-200 flex gap-1 overflow-x-auto" role="tablist">
                {TABS.map((t) => (
                  <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                    className={`min-h-[44px] px-4 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${tab === t.key ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-900'}`}>
                    {t.label}
                    {t.key === 'tasks' && openTasks ? <span className="ml-1.5 text-[11px] bg-gray-900 text-white rounded-full px-1.5">{openTasks}</span> : null}
                    {t.key === 'notes' && data.notes.length ? <span className="ml-1.5 text-[11px] text-gray-400">{data.notes.length}</span> : null}
                  </button>
                ))}
              </div>
              <div className="pt-3">
                {tab === 'timeline' && <Timeline token={token} leadId={leadId} items={timeline} onMore={more} moreBusy={moreBusy} hasMore={hasMore} onChanged={load} />}
                {tab === 'notes' && <NotesTab token={token} leadId={leadId} notes={data.notes} onChanged={load} />}
                {tab === 'tasks' && <TasksTab token={token} leadId={leadId} tasks={data.tasks} teammates={teammates} currentAgentId={currentAgentId ?? data.viewer_id} onChanged={load} />}
                {tab === 'texts' && <TextsTab token={token} lead={lead} onSent={load} />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
