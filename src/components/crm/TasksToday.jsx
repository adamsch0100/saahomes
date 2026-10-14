/**
 * "Due today": the signed-in agent's tasks due by tonight (overdue first),
 * across all their leads. Tick one off, or open the lead.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { crm } from '../../utils/crmApi.js';

const KIND = { call: 'Call', text: 'Text', email: 'Email', follow_up: 'Follow up', showing: 'Showing' };
const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function TasksToday({ token, onOpenLead, refreshKey = 0 }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setTasks(await crm.tasks(token, 'today'));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load, refreshKey]);

  const done = async (t) => {
    setTasks((list) => list.filter((x) => x.id !== t.id));
    try {
      await crm.editTask(token, t.id, { done: true });
    } catch (e) {
      setError(e.message);
      load();
    }
  };

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!tasks) return null;

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm" aria-labelledby="tasks-today-heading">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tasks-today-heading" className="text-lg font-bold text-gray-900">Due today</h2>
        <span className="text-xs text-gray-500">{tasks.length ? `${tasks.length} task${tasks.length === 1 ? '' : 's'}` : ''}</span>
      </div>
      {tasks.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">You’re all caught up. Add tasks from any lead.</p>
      ) : (
        <ul className="mt-2 divide-y divide-gray-100">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-2">
              <input type="checkbox" onChange={() => done(t)} className="w-5 h-5 shrink-0" aria-label={`Mark “${t.title}” done`} />
              <button type="button" onClick={() => onOpenLead?.(t.lead_id, 'tasks')} className="min-w-0 flex-1 text-left min-h-[44px]">
                <p className="text-sm font-semibold text-gray-900 truncate">{t.title}</p>
                <p className={`text-xs ${t.overdue ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>
                  {KIND[t.kind] || 'Task'} · {t.lead_name} · {t.overdue ? `overdue since ${day(t.due_at)}` : `by ${time(t.due_at)}`}
                </p>
              </button>
              {t.lead_phone && (
                <a href={`tel:${t.lead_phone}`} className="shrink-0 min-h-[40px] px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 flex items-center hover:border-black">Call</a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
