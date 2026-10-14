/**
 * Action plans: a set of emails, texts, tasks and waits that run on their
 * own for a lead. Start from the team's plans (four come ready to use), make
 * your own, or copy one to change it. Owners share plans with the team.
 * A plan pauses itself when the lead replies or asks for a tour.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm } from '../../utils/crmApi.js';

const inputClass = 'w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white';
const btnLight = 'min-h-[40px] px-3 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:border-black disabled:opacity-50';
const btnDark = 'min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50';

const STAGES = [
  ['new', 'New'], ['nurturing', 'Nurturing'], ['showing', 'Showing'], ['active', 'Active'], ['closed', 'Closed'], ['lost', 'Lost'],
];
const TASK_KINDS = [['call', 'Call'], ['text', 'Text'], ['email', 'Email'], ['follow_up', 'Follow up'], ['showing', 'Showing']];
const STEP_LABEL = { email: 'Email', text: 'Text', task: 'Task', wait: 'Wait' };
const STEP_STYLE = {
  email: 'bg-indigo-50 text-indigo-800', text: 'bg-teal-50 text-teal-800', task: 'bg-amber-50 text-amber-900', wait: 'bg-gray-100 text-gray-700',
};
const FIELD_LABEL = {
  first_name: 'first name', agent_name: 'agent name', agent_first_name: 'agent first name', agent_phone: 'agent phone',
  brokerage: 'brokerage', site_url: 'site link', search_url: 'search link', home_url: 'home value link',
};

function triggerText(trigger, sources) {
  const t = trigger || {};
  if (t.type === 'new_lead') {
    const names = (t.sources || []).map((s) => sources?.[s] || s);
    return names.length ? `A new lead comes in (${names.join(', ')})` : 'Any new lead comes in';
  }
  if (t.type === 'stage') return `Stage changes to ${STAGES.find(([k]) => k === t.stage)?.[1] || t.stage}`;
  if (t.type === 'tag') return `Tag “${t.tag}” is added`;
  if (t.type === 'closed') return 'Marked Closed';
  return 'Added by hand';
}

const blankStep = (type) => ({
  email: { type: 'email', subject: '', body: '' },
  text: { type: 'text', body: '' },
  task: { type: 'task', title: '', task_kind: 'call' },
  wait: { type: 'wait', days: 2 },
}[type]);

function StepEditor({ step, index, count, onChange, onMove, onRemove }) {
  const id = `step-${index}`;
  return (
    <li className="rounded-xl border border-gray-200 p-3 bg-white">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-gray-400 w-5">{index + 1}</span>
        <span className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${STEP_STYLE[step.type]}`}>{STEP_LABEL[step.type]}</span>
        <div className="ml-auto flex gap-1">
          <button type="button" className="min-h-[36px] min-w-[36px] rounded-lg border border-gray-200 text-sm disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Move step ${index + 1} up`}>↑</button>
          <button type="button" className="min-h-[36px] min-w-[36px] rounded-lg border border-gray-200 text-sm disabled:opacity-30" disabled={index === count - 1} onClick={() => onMove(1)} aria-label={`Move step ${index + 1} down`}>↓</button>
          <button type="button" className="min-h-[36px] px-2 rounded-lg border border-gray-200 text-sm text-red-700" onClick={onRemove} aria-label={`Remove step ${index + 1}`}>Remove</button>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        {step.type === 'wait' && (
          <label className="flex items-center gap-2 text-sm text-gray-800" htmlFor={id}>
            Wait
            <input id={id} type="number" min={1} max={365} value={step.days} onChange={(e) => onChange({ ...step, days: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-20 min-h-[40px] border border-gray-300 rounded-lg px-2 text-sm" />
            days
          </label>
        )}
        {step.type === 'email' && (
          <>
            <label className="sr-only" htmlFor={`${id}-subject`}>Subject</label>
            <input id={`${id}-subject`} className={inputClass} placeholder="Subject" value={step.subject} maxLength={160} onChange={(e) => onChange({ ...step, subject: e.target.value })} />
            <label className="sr-only" htmlFor={`${id}-body`}>Message</label>
            <textarea id={`${id}-body`} rows={4} className={`${inputClass} py-2`} placeholder="Hi {first_name}, …" value={step.body} maxLength={5000} onChange={(e) => onChange({ ...step, body: e.target.value })} />
          </>
        )}
        {step.type === 'text' && (
          <>
            <label className="sr-only" htmlFor={`${id}-body`}>Text</label>
            <textarea id={`${id}-body`} rows={2} className={`${inputClass} py-2`} placeholder="Hi {first_name}, it’s {agent_first_name}…" value={step.body} maxLength={480} onChange={(e) => onChange({ ...step, body: e.target.value })} />
            <p className="text-xs text-gray-500">Only goes to people who agreed to texts, between 8am and 9pm. Your brokerage name and “Reply STOP to opt out” are added.</p>
          </>
        )}
        {step.type === 'task' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="sr-only" htmlFor={`${id}-kind`}>Kind of task</label>
            <select id={`${id}-kind`} className={`${inputClass} sm:w-36`} value={step.task_kind} onChange={(e) => onChange({ ...step, task_kind: e.target.value })}>
              {TASK_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="sr-only" htmlFor={`${id}-title`}>Task</label>
            <input id={`${id}-title`} className={inputClass} placeholder="Call {first_name} to say hello" value={step.title} maxLength={200} onChange={(e) => onChange({ ...step, title: e.target.value })} />
          </div>
        )}
      </div>
    </li>
  );
}

function PlanEditor({ token, plan, meta, onCancel, onSaved }) {
  const [p, setP] = useState(() => ({
    name: plan?.name || '',
    description: plan?.description || '',
    trigger: plan?.trigger || { type: 'manual' },
    auto_start: plan?.auto_start ?? false,
    pause_on_reply: plan?.pause_on_reply ?? true,
    shared: plan?.shared ?? meta.can_share,
    steps: plan?.steps?.length ? plan.steps : [blankStep('email')],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setP((x) => ({ ...x, ...patch }));
  const setStep = (i, s) => set({ steps: p.steps.map((x, j) => (j === i ? s : x)) });
  const move = (i, d) => {
    const steps = [...p.steps];
    [steps[i], steps[i + d]] = [steps[i + d], steps[i]];
    set({ steps });
  };
  const toggleSource = (s) => {
    const cur = p.trigger.sources || [];
    set({ trigger: { ...p.trigger, sources: cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s] } });
  };
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = { ...p, steps: p.steps.map((s) => (s.type === 'wait' ? { ...s, days: Number(s.days) } : s)) };
      if (!meta.can_share) delete body.shared;
      const saved = plan?.id ? await crm.updatePlan(token, plan.id, body) : await crm.createPlan(token, body);
      onSaved(saved);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const days = p.steps.reduce((n, s) => n + (s.type === 'wait' ? Number(s.days) || 0 : 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-lg font-bold text-gray-900">{plan?.id ? 'Edit plan' : 'New plan'}</h3>
        <span className="ml-auto text-xs text-gray-500">{p.steps.length} steps · {days} days</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1" htmlFor="plan-name">Name</label>
          <input id="plan-name" className={inputClass} value={p.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} placeholder="New buyer from Zillow" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1" htmlFor="plan-trigger">Starts when</label>
          <select id="plan-trigger" className={inputClass} value={p.trigger.type} onChange={(e) => set({ trigger: { type: e.target.value, ...(e.target.value === 'stage' ? { stage: 'nurturing' } : {}), ...(e.target.value === 'tag' ? { tag: '' } : {}), ...(e.target.value === 'new_lead' ? { sources: [] } : {}) } })}>
            <option value="manual">I add someone by hand</option>
            <option value="new_lead">A new lead comes in</option>
            <option value="stage">A lead’s stage changes</option>
            <option value="tag">A tag is added</option>
            <option value="closed">A lead is marked Closed</option>
          </select>
        </div>
      </div>
      {p.trigger.type === 'new_lead' && (
        <fieldset>
          <legend className="text-sm font-semibold text-gray-900">From these sources <span className="font-normal text-gray-500">(none checked = any source)</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(meta.sources || {}).map(([k, label]) => (
              <label key={k} className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-sm cursor-pointer ${(p.trigger.sources || []).includes(k) ? 'bg-gray-900 text-white border-gray-900' : 'bg-white border-gray-300 text-gray-800'}`}>
                <input type="checkbox" className="sr-only" checked={(p.trigger.sources || []).includes(k)} onChange={() => toggleSource(k)} />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {p.trigger.type === 'stage' && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1" htmlFor="plan-stage">Stage</label>
          <select id="plan-stage" className={`${inputClass} sm:w-60`} value={p.trigger.stage} onChange={(e) => set({ trigger: { type: 'stage', stage: e.target.value } })}>
            {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
      )}
      {p.trigger.type === 'tag' && (
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-1" htmlFor="plan-tag">Tag</label>
          <input id="plan-tag" className={`${inputClass} sm:w-60`} value={p.trigger.tag || ''} maxLength={40} onChange={(e) => set({ trigger: { type: 'tag', tag: e.target.value } })} placeholder="Seller" />
        </div>
      )}
      <div className="space-y-2">
        {p.trigger.type !== 'manual' && (
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-1 w-4 h-4" checked={p.auto_start} onChange={(e) => set({ auto_start: e.target.checked })} />
            <span><span className="font-semibold">Start on its own.</span> When this happens, the lead goes on the plan without anyone pressing a button.</span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" className="mt-1 w-4 h-4" checked={p.pause_on_reply} onChange={(e) => set({ pause_on_reply: e.target.checked })} />
          <span><span className="font-semibold">Pause when they reply</span> or ask for a tour, so nobody gets a canned message mid-conversation.</span>
        </label>
        {meta.can_share && (
          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input type="checkbox" className="mt-1 w-4 h-4" checked={p.shared} onChange={(e) => set({ shared: e.target.checked })} />
            <span><span className="font-semibold">Share with the team.</span> Every agent can use it; only owners can change it.</span>
          </label>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900">Steps</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Fill in names with {Object.keys(FIELD_LABEL).slice(0, 4).map((f) => `{${f}}`).join(', ')}, {'{search_url}'} and more. Every email has an unsubscribe link and your branding.
        </p>
        <ol className="mt-2 space-y-2">
          {p.steps.map((s, i) => (
            <StepEditor key={i} step={s} index={i} count={p.steps.length} onChange={(n) => setStep(i, n)} onMove={(d) => move(i, d)} onRemove={() => set({ steps: p.steps.filter((_, j) => j !== i) })} />
          ))}
        </ol>
        <div className="mt-2 flex flex-wrap gap-2">
          {['email', 'text', 'task', 'wait'].map((t) => (
            <button key={t} type="button" className={btnLight} onClick={() => set({ steps: [...p.steps, blankStep(t)] })}>+ {STEP_LABEL[t]}</button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2" role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" className={btnLight} onClick={onCancel}>Cancel</button>
        <button type="button" className={btnDark} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save plan'}</button>
      </div>
    </div>
  );
}

function PlanCard({ plan, meta, onEdit, onCopy, onDelete, onToggle, busy }) {
  return (
    <li className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900">{plan.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {plan.shared ? 'Team plan' : plan.owner_name ? `${plan.owner_name}’s plan` : 'Your plan'} · {plan.steps.length} steps · {plan.days} days
            {plan.active_runs ? ` · ${plan.active_runs} on it now` : ''}
          </p>
        </div>
      </div>
      {plan.description && <p className="mt-2 text-sm text-gray-700">{plan.description}</p>}
      <p className="mt-2 text-sm text-gray-800"><span className="font-semibold">Starts:</span> {triggerText(plan.trigger, meta.sources)}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {plan.steps.map((s, i) => (
          <span key={i} className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STEP_STYLE[s.type]}`}>{s.type === 'wait' ? `${s.days}d` : STEP_LABEL[s.type]}</span>
        ))}
      </div>
      <div className="mt-auto pt-3 flex flex-wrap items-center gap-2">
        {plan.trigger?.type !== 'manual' && (
          plan.can_edit ? (
            <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 mr-auto">
              <input type="checkbox" className="w-4 h-4" checked={plan.auto_start} disabled={busy} onChange={(e) => onToggle(e.target.checked)} />
              Starts on its own
            </label>
          ) : (
            <span className={`text-xs font-semibold mr-auto ${plan.auto_start ? 'text-emerald-700' : 'text-gray-500'}`}>{plan.auto_start ? 'Starts on its own' : 'Off: add people by hand'}</span>
          )
        )}
        {plan.trigger?.type === 'manual' && <span className="mr-auto" />}
        {plan.can_edit && <button type="button" className={btnLight} onClick={onEdit}>Edit</button>}
        <button type="button" className={btnLight} disabled={busy} onClick={onCopy}>Copy</button>
        {plan.can_edit && <button type="button" className={`${btnLight} text-red-700`} disabled={busy} onClick={onDelete}>Delete</button>}
      </div>
    </li>
  );
}

export default function ActionPlans({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // plan, or {} for new
  const [busyId, setBusyId] = useState(null);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await crm.plans(token));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const run = async (id, fn, done) => {
    setBusyId(id);
    setMsg(null);
    try {
      await fn();
      if (done) setMsg(done);
      await load();
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p className="text-sm text-red-700" role="alert">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (editing) {
    return (
      <PlanEditor token={token} plan={editing.id ? editing : null} meta={data}
        onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg('Plan saved.'); load(); }} />
    );
  }
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900">Action plans</h2>
          <p className="text-sm text-gray-600">Emails, texts and reminders that go out on schedule, then step aside the moment a lead replies. Add a lead to a plan from their Plans tab.</p>
        </div>
        <button type="button" className={`${btnDark} sm:ml-auto shrink-0`} onClick={() => setEditing({})}>New plan</button>
      </div>
      {msg && <p className="text-sm text-gray-800 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2" role="status">{msg}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {data.plans.map((p) => (
          <PlanCard key={p.id} plan={p} meta={data} busy={busyId === p.id}
            onEdit={() => setEditing(p)}
            onCopy={() => run(p.id, () => crm.copyPlan(token, p.id), `Copied “${p.name}”. Edit the copy to make it yours.`)}
            onDelete={() => { if (window.confirm(`Delete “${p.name}”? Anyone on it stops getting its messages.`)) run(p.id, () => crm.deletePlan(token, p.id), 'Plan deleted.'); }}
            onToggle={(on) => run(p.id, () => crm.updatePlan(token, p.id, { auto_start: on }))} />
        ))}
      </ul>
    </div>
  );
}
