/**
 * What the site does in Follow Up Boss on its own: activity, tags, the
 * repeat-view note, and alerts for new contacts. Read-only; the key itself is
 * connected in Settings > Follow Up Boss.
 */
import React from 'react';

const ALERTS_PILL = {
  active: { label: 'On', cls: 'bg-green-50 text-green-700' },
  needs_system: { label: 'Waiting on us', cls: 'bg-amber-50 text-amber-800' },
  needs_owner_key: { label: 'Needs owner key', cls: 'bg-amber-50 text-amber-800' },
  failed: { label: 'Not connected', cls: 'bg-red-50 text-red-700' },
  pending: { label: 'Connecting', cls: 'bg-blue-50 text-blue-700' },
  off: { label: 'Off', cls: 'bg-gray-100 text-gray-600' },
};

export default function FubAutomationCard({ fub }) {
  if (!fub || fub.new_contact_alerts === 'home') return null;
  const pill = ALERTS_PILL[fub.new_contact_alerts] || ALERTS_PILL.off;
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm" aria-labelledby="fub-auto-title">
      <h2 id="fub-auto-title" className="text-lg font-bold text-gray-900">What happens in Follow Up Boss</h2>
      <p className="text-sm text-gray-500 mt-1">
        {fub.connected
          ? 'Your site keeps Follow Up Boss current on its own. Your agents keep working there.'
          : 'Connect your Follow Up Boss key above and your site keeps it current on its own.'}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-gray-700">
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
          <span>Searches, saved homes and home views show up on the contact’s timeline.</span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
          <span>
            Buyers get tagged <span className="font-mono text-xs bg-gray-100 px-1 rounded">Active searcher</span> when they save a search,
            and <span className="font-mono text-xs bg-gray-100 px-1 rounded">Hot: 3+ views</span> when they keep coming back to one home.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
          <span>When a buyer looks at the same home three times, the agent gets a note so they can reach out.</span>
        </li>
      </ul>
      <div className="mt-4 rounded-lg bg-gray-50 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-gray-900">Home alerts for new contacts</p>
          <span className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2 py-1 rounded ${pill.cls}`}>{pill.label}</span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {fub.new_contact_alerts === 'pending'
            ? 'Turning on now. Refresh in a minute.'
            : fub.new_contact_alerts_text
            ||'When a contact is added in Follow Up Boss, they get a starter home alert from your site and a welcome email in your brand.'}
        </p>
      </div>
    </section>
  );
}
