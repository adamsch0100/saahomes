/**
 * In the lead panel: the lead's tags, and where they are in each action
 * plan (next step, paused because they replied, what already went out),
 * with pause / resume / stop and "Add to a plan".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm } from '../../utils/crmApi.js';

const btnLight = 'min-h-[40px] px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:border-black disabled:opacity-50';
const btnDark = 'min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50';

const when = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const STATUS = {
  active: { label: 'Running', cls: 'bg-emerald-50 text-emerald-800' },
  paused: { label: 'Paused', cls: 'bg-amber-50 text-amber-900' },
  done: { label: 'Finished', cls: 'bg-gray-100 text-gray-700' },
  stopped: { label: 'Stopped', cls: 'bg-gray-100 text-gray-700' },
};

/** Tags as chips; type and press Enter to add. */
export function TagsRow({ token, leadId, tags = [], onSaved }) {
  const [list, setList] = useState(tags || []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { setList(tags || []); }, [tags]);

  const save = async (next) => {
    setBusy(true);
    setError(null);
    try {
      const r = await crm.setTags(token, leadId, next);
      setList(r.tags);
      onSaved?.(r.tags);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const add = (e) => {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    if (list.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    save([...list, t]);
  };

  return (
    <div className="mt-2">
      <form onSubmit={add} className="flex flex-wrap items-center gap-1.5">
        {list.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full pl-2.5 pr-1 py-1">
            {t}
            <button type="button" disabled={busy} onClick={() => save(list.filter((x) => x !== t))} className="w-5 h-5 rounded-full text-gray-500 hover:bg-gray-300 hover:text-gray-900" aria-label={`Remove tag ${t}`}>×</button>
          </span>
        ))}
        <label className="sr-only" htmlFor={`tag-${leadId}`}>Add a tag</label>
        <input id={`tag-${leadId}`} value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} placeholder={list.length ? 'Add tag' : 'Add a tag (Seller, VIP…)'}
          className="min-h-[32px] w-36 border border-dashed border-gray-300 rounded-full px-3 text-xs focus:outline-none focus:ring-2 focus:ring-black" maxLength={40} />
      </form>
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}

function RunCard({ token, run, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(run.status === 'active' || run.status === 'paused');
  const [error, setError] = useState(null);
  const s = STATUS[run.status] || STATUS.done;
  const act = async (action) => {
    setBusy(true);
    setError(null);
    try {
      await crm.changeRun(token, run.id, action);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const live = run.status === 'active' || run.status === 'paused';
  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold text-gray-900 text-sm">{run.name}</p>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>
        <span className="text-xs text-gray-500">Step {run.step} of {run.steps_total}</span>
      </div>
      {run.status === 'paused' && <p className="mt-1 text-sm text-amber-900">{run.pause_text}. Resume when you’re ready, or stop it.</p>}
      {run.status === 'active' && run.next_step && (
        <p className="mt-1 text-sm text-gray-700">Next: {run.next_step}{run.next_at ? ` · ${when(run.next_at)}` : ''}</p>
      )}
      {!live && run.end_text && <p className="mt-1 text-sm text-gray-600">{run.end_text}{run.ended_at ? ` · ${when(run.ended_at)}` : ''}</p>}
      {live && (
        <div className="mt-2 flex flex-wrap gap-2">
          {run.status === 'active' && <button type="button" className={btnLight} disabled={busy} onClick={() => act('pause')}>Pause</button>}
          {run.status === 'paused' && <button type="button" className={btnLight} disabled={busy} onClick={() => act('resume')}>Resume</button>}
          <button type="button" className={btnLight} disabled={busy} onClick={() => act('stop')}>Stop</button>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-700" role="alert">{error}</p>}
      <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 text-xs font-semibold text-gray-600 underline" aria-expanded={open}>
        {open ? 'Hide steps' : 'Show steps'}
      </button>
      {open && (
        <>
          <ol className="mt-2 space-y-1">
            {run.steps.map((st) => (
              <li key={st.index} className={`text-xs flex gap-2 ${st.done ? 'text-gray-400' : 'text-gray-800'}`}>
                <span className="w-4 text-right">{st.index + 1}.</span>
                <span className={st.done ? 'line-through' : ''}>{st.label}</span>
              </li>
            ))}
          </ol>
          {run.log.length > 0 && (
            <ul className="mt-2 border-t border-gray-100 pt-2 space-y-1">
              {run.log.slice(0, 8).map((l, i) => (
                <li key={`${l.created_at}-${i}`} className="text-xs text-gray-600">
                  <span className="text-gray-400">{when(l.created_at)}</span> · {l.detail}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  );
}

export default function LeadPlansTab({ token, leadId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await crm.leadPlans(token, leadId));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token, leadId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!pick) return;
    setBusy(true);
    setMsg(null);
    try {
      await crm.addToPlan(token, leadId, Number(pick));
      setPick('');
      setMsg({ kind: 'ok', text: 'Added. The first step goes out within a minute.' });
      load();
    } catch (e) {
      setMsg({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  const onPlan = new Set(data.runs.filter((r) => r.status === 'active' || r.status === 'paused').map((r) => r.plan_id));
  const choices = data.plans.filter((p) => !onPlan.has(p.id));
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
        <label htmlFor={`plan-pick-${leadId}`} className="block text-sm font-semibold text-gray-900">Add to a plan</label>
        <p className="text-xs text-gray-600 mt-0.5">Plans pause on their own when this person replies or asks for a tour.</p>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <select id={`plan-pick-${leadId}`} value={pick} onChange={(e) => setPick(e.target.value)} className="flex-1 min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm bg-white">
            <option value="">Choose a plan…</option>
            {choices.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.steps} steps{p.days ? `, ${p.days} days` : ''}</option>)}
          </select>
          <button type="button" className={btnDark} disabled={!pick || busy} onClick={add}>{busy ? 'Adding…' : 'Add'}</button>
        </div>
        {msg && <p className={`mt-2 text-sm ${msg.kind === 'error' ? 'text-red-700' : 'text-emerald-700'}`} role="status">{msg.text}</p>}
      </div>
      {data.runs.length === 0
        ? <p className="text-sm text-gray-500 text-center py-4">Not on any plan yet.</p>
        : <ul className="space-y-3">{data.runs.map((r) => <RunCard key={r.id} token={token} run={r} onChanged={load} />)}</ul>}
    </div>
  );
}
