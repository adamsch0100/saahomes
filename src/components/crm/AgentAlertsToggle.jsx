/**
 * "Alert me on this device": web push for hot leads and replies, for the
 * signed-in agent. Which alerts come (push, text) is set in the profile.
 */
import React, { useEffect, useState } from 'react';
import { enableAgentAlerts, agentAlertsOn } from '../../utils/crmApi.js';
import { pushSupported, needsHomeScreenFirst } from '../../utils/push.js';

export default function AgentAlertsToggle({ token }) {
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    agentAlertsOn().then(setOn).catch(() => setOn(false));
  }, []);

  if (on === null) return null;
  const supported = pushSupported();
  const iosHint = needsHomeScreenFirst();

  const turnOn = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await enableAgentAlerts(token);
      setOn(true);
      setMsg('Done. You’ll get an alert here the moment a lead turns hot or texts you back.');
    } catch (e) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{on ? 'Hot-lead alerts are on for this device' : 'Get hot-lead alerts on this device'}</p>
        <p className="text-xs text-gray-500">
          {on
            ? 'Tours, repeat views, offer questions, returning leads and replies. Change what you get in Profile.'
            : iosHint
              ? 'On iPhone, add this site to your home screen first, then open it from there.'
              : 'Know the moment a lead asks for a tour, keeps coming back to a home, or texts you back.'}
        </p>
        {msg && <p className="text-xs text-gray-700 mt-1" role="status">{msg}</p>}
      </div>
      {!on && supported && !iosHint && (
        <button type="button" onClick={turnOn} disabled={busy} className="shrink-0 min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:opacity-50">
          {busy ? 'Turning on…' : 'Turn on alerts'}
        </button>
      )}
    </div>
  );
}
