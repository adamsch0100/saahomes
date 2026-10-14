/**
 * The brokerage owner's first run, around the normal admin console:
 *
 *  - the setup steps (brand, website, Follow Up Boss, MLS, agents, billing),
 *    shown the first time an owner of a new brokerage signs in. Each step is
 *    the matching Settings form, not a copy. Progress is saved on the server,
 *    so the owner can leave and come back;
 *  - a "Finish setup" banner until it's done;
 *  - billing banners, and a paused screen with Billing when the trial ran out;
 *  - the emailed "Confirm my email" link (/admin?confirm=...);
 *  - a strip naming the brokerage when its console runs on the platform's site.
 *
 * Renders nothing for SAA's own console or the platform owner.
 */
import React, { useCallback, useEffect, useState } from 'react';
import BrokerageSettings, { SettingsSectionFilter } from './BrokerageSettings.jsx';
import AgentsManager from './AgentsManager.jsx';
import BillingCard from './BillingCard.jsx';
import FubAutomationCard from './FubAutomationCard.jsx';
import EmbedsCard from './EmbedsCard.jsx';
import { getOwnerSetup, patchOwnerSetup, confirmOwnerEmail, resendOwnerConfirm } from '../../utils/plugAndPlayApi.js';
import { consoleBrokerage, clearConsoleBrokerage } from '../../utils/consoleBrokerage.js';
import { applyBrandTheme, themeFromBrand } from '../../utils/brandTheme.js';

const STEPS = {
  brand: {
    label: 'Brand',
    title: 'Make it yours',
    intro: 'Your name, logo, colors and phone go on your website, your emails and the app. Save, then continue.',
  },
  domain: {
    label: 'Website',
    title: 'Your website address',
    intro: 'Your site already works on a free address. Point your own domain at it now, or do it later from Settings.',
  },
  fub: {
    label: 'Follow Up Boss',
    title: 'Connect Follow Up Boss',
    intro: 'Optional. New leads, searches and home views land in your Follow Up Boss account. You can skip this and connect later.',
  },
  mls: {
    label: 'MLS',
    title: 'Your MLS feed',
    intro: 'We’ll show sample homes until your MLS approves you. Ask your MLS for an IDX or data feed license for your brokerage; approval usually takes a few days to a few weeks.',
  },
  agents: {
    label: 'Agents',
    title: 'Invite your agents',
    intro: 'Each agent gets their own sign-in and their own leads. You can add more any time from Agent seats.',
  },
  billing: {
    label: 'Billing',
    title: 'Billing',
    intro: 'Your free trial is on. Add a payment method now or any time before it ends.',
  },
};

const MLS_SECTION = (title) => /\bmls\b|listing feed|idx/i.test(title);

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : '');

// One confirmation per link, even if the page renders twice.
const confirmations = new Map();
function confirmOnce(token) {
  if (!confirmations.has(token)) confirmations.set(token, confirmOwnerEmail(token));
  return confirmations.get(token);
}

function readConfirmParam() {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('confirm');
    if (!t) return null;
    params.delete('confirm');
    const q = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash);
    return t;
  } catch {
    return null;
  }
}

/**
 * The emailed "Confirm my email" link, and which brokerage a platform-site
 * console is for. Also shown on the sign-in screen.
 */
export function ConsoleNotes({ onConfirmed, signIn = false }) {
  const [confirm] = useState(readConfirmParam);
  const [state, setState] = useState(confirm ? { kind: 'busy' } : null);
  const [slug] = useState(consoleBrokerage);

  useEffect(() => {
    if (slug) applyBrandTheme(themeFromBrand(null));
  }, [slug]);

  useEffect(() => {
    if (!confirm) return;
    let cancelled = false;
    confirmOnce(confirm)
      .then(() => {
        if (cancelled) return;
        setState({ kind: 'ok' });
        onConfirmed?.();
      })
      .catch((err) => {
        if (!cancelled) setState({ kind: 'error', text: err.message || 'This link has expired or was already used.' });
      });
    return () => { cancelled = true; };
  }, [confirm]); // eslint-disable-line react-hooks/exhaustive-deps

  const signInNote = signIn && slug ? (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 flex flex-wrap items-center justify-between gap-2">
      <span>
        Signing in to the console for <span className="font-mono text-gray-900">{slug}</span>.
      </span>
      <button
        type="button"
        onClick={() => { clearConsoleBrokerage(); window.location.assign('/admin'); }}
        className="min-h-[36px] px-2 underline text-gray-600 hover:text-black"
      >
        Use a different console
      </button>
    </div>
  ) : null;

  if (!state) return signInNote;
  return (
    <>
    {signInNote}
    <div
      role="status"
      className={`mb-4 border rounded-lg px-4 py-3 text-sm ${state.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : state.kind === 'ok' ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-600'}`}
    >
      {state.kind === 'busy' ? 'Confirming your email…' : state.kind === 'ok' ? 'Thanks, your email is confirmed.' : state.text}
    </div>
    </>
  );
}

function StepNav({ order, steps, current, onPick }) {
  return (
    <ol className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 pb-1 lg:pb-0" aria-label="Setup steps">
      {order.map((key, i) => {
        const status = steps[key];
        const active = key === current;
        return (
          <li key={key} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(key)}
              aria-current={active ? 'step' : undefined}
              className={`w-full min-h-[44px] flex items-center gap-2.5 rounded-lg px-3 text-left text-sm transition-colors ${active ? 'bg-gray-900 text-white' : 'bg-white lg:bg-transparent text-gray-700 border border-gray-200 lg:border-transparent hover:bg-white hover:border-gray-200'}`}
            >
              <span
                aria-hidden="true"
                className={`h-6 w-6 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${status === 'done' ? 'bg-green-600 text-white' : active ? 'bg-white text-gray-900' : 'bg-gray-200 text-gray-600'}`}
              >
                {status === 'done' ? '✓' : i + 1}
              </span>
              <span className="whitespace-nowrap font-medium">{STEPS[key].label}</span>
              {status === 'skipped' && <span className={`text-xs ${active ? 'text-gray-300' : 'text-gray-400'}`}>skipped</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function SetupWizard({ token, setup, onChange, onClose, onOpenTab }) {
  const order = setup.order;
  const firstOpen = order.find((k) => setup.steps[k] === 'open') || order[order.length - 1];
  const [current, setCurrent] = useState(firstOpen);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const idx = order.indexOf(current);
  const step = STEPS[current];
  const last = idx === order.length - 1;

  const save = async (body, busyKey) => {
    setBusy(busyKey);
    setError(null);
    try {
      const res = await patchOwnerSetup(token, body);
      onChange(res.data);
      return res.data;
    } catch (err) {
      setError(err.message || 'Could not save your progress');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const advance = async (status) => {
    const next = await save({ step: current, status }, status);
    if (!next) return;
    if (last) {
      const done = await save({ completed: true }, 'finish');
      if (done) onClose('completed');
      return;
    }
    setCurrent(order[idx + 1]);
    if (typeof window !== 'undefined') document.getElementById('setup-top')?.scrollIntoView({ block: 'start' });
  };

  const later = async () => {
    const res = await save({ dismissed: true }, 'later');
    if (res) onClose('later');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div id="setup-top" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Set up {setup.brokerage?.name || 'your brokerage'} · {setup.done_count} of {order.length} done
            </p>
            <h1 id="setup-title" className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">{step.title}</h1>
          </div>
          <button
            type="button"
            onClick={later}
            disabled={!!busy}
            className="shrink-0 min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
          >
            {busy === 'later' ? 'Saving…' : 'Finish later'}
          </button>
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-[200px_1fr] lg:gap-8">
          <div className="mb-5 lg:mb-0">
            <StepNav order={order} steps={setup.steps} current={current} onPick={setCurrent} />
          </div>

          <div className="min-w-0 max-w-3xl space-y-5">
            <p className="text-sm sm:text-base text-gray-600">
              {current === 'domain' && !setup.site?.has_address
                ? 'Connect your website domain so buyers can find your site. Do it now or any time from Settings; the rest of setup doesn’t need it.'
                : step.intro}
            </p>

            {current === 'brand' && (
              <SettingsSectionFilter.Provider value={['Brand']}>
                <BrokerageSettings token={token} />
              </SettingsSectionFilter.Provider>
            )}

            {current === 'domain' && (
              <>
                {setup.site?.url && (
                  <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
                    <p className="text-sm text-gray-500">Your site is live at</p>
                    <a href={setup.site.url} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-gray-900 underline break-all">
                      {setup.site.url.replace(/^https?:\/\//, '')}
                    </a>
                  </div>
                )}
                <SettingsSectionFilter.Provider value={['Website domain']}>
                  <BrokerageSettings token={token} />
                </SettingsSectionFilter.Provider>
              </>
            )}

            {current === 'fub' && (
              <>
                <SettingsSectionFilter.Provider value={['Follow Up Boss']}>
                  <BrokerageSettings token={token} />
                </SettingsSectionFilter.Provider>
                <FubAutomationCard fub={setup.fub} />
              </>
            )}

            {current === 'mls' && (
              <>
                <section className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900">MLS paperwork</h2>
                  <ol className="mt-3 space-y-2 text-sm text-gray-700 list-decimal pl-5">
                    <li>Ask your MLS for an IDX or data feed license, and name this site as your vendor.</li>
                    <li>Sign and return their agreement. They’ll tell you when you’re approved.</li>
                    <li>Until then your site shows sample homes, clearly marked, so you can share it and try everything.</li>
                  </ol>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {setup.mls_paperwork_started_at ? (
                      <p className="text-sm text-green-700 font-medium">Paperwork started {fmtDate(setup.mls_paperwork_started_at)}.</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => save({ mls_paperwork_started: true }, 'mls')}
                        disabled={!!busy}
                        className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
                      >
                        {busy === 'mls' ? 'Saving…' : 'I’ve started the paperwork'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { onClose('settings'); onOpenTab?.('settings'); }}
                      className="min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black"
                    >
                      Open MLS settings
                    </button>
                  </div>
                </section>
                <SettingsSectionFilter.Provider value={MLS_SECTION}>
                  <BrokerageSettings token={token} />
                </SettingsSectionFilter.Provider>
              </>
            )}

            {current === 'agents' && <AgentsManager token={token} />}

            {current === 'billing' && <BillingCard token={token} compact />}

            {error && (
              <div className="border border-red-200 bg-red-50 text-red-800 rounded-lg px-3 py-2 text-sm">{error}</div>
            )}

            <div className="sticky bottom-0 -mx-4 px-4 sm:mx-0 sm:px-0 py-3 bg-gray-50/95 backdrop-blur border-t border-gray-200 sm:border-0 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setCurrent(order[Math.max(0, idx - 1)])}
                disabled={idx === 0 || !!busy}
                className="min-h-[44px] px-4 rounded-lg text-sm font-medium text-gray-700 hover:text-black disabled:opacity-40"
              >
                Back
              </button>
              <div className="flex gap-2">
                {!last && (
                  <button
                    type="button"
                    onClick={() => advance('skipped')}
                    disabled={!!busy}
                    className="min-h-[44px] px-4 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50"
                  >
                    {busy === 'skipped' ? 'Saving…' : 'Skip for now'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => advance('done')}
                  disabled={!!busy}
                  className="min-h-[44px] px-5 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50"
                >
                  {busy === 'done' || busy === 'finish' ? 'Saving…' : last ? 'Finish setup' : 'Continue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Banner({ kind = 'info', children, action }) {
  const cls = kind === 'error'
    ? 'border-red-200 bg-red-50 text-red-900'
    : kind === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : 'border-gray-200 bg-white text-gray-800';
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm ${cls}`}>
      <div className="min-w-0">{children}</div>
      {action ? <div className="shrink-0 flex flex-wrap gap-2">{action}</div> : null}
    </div>
  );
}

const bannerButton = 'min-h-[44px] px-4 rounded-lg text-sm font-semibold text-white bg-gray-900 hover:bg-black disabled:opacity-50';
const bannerLink = 'min-h-[44px] px-3 rounded-lg text-sm font-medium underline';

export default function OwnerSetup({ token, onOpenTab, onLeave }) {
  const [setup, setSetup] = useState(null);
  const [open, setOpen] = useState(false);
  const [resend, setResend] = useState(null);
  const [slug] = useState(consoleBrokerage);

  const load = useCallback(async () => {
    try {
      const res = await getOwnerSetup(token);
      const data = res.data;
      setSetup(data);
      return data;
    } catch {
      setSetup(null);
      return null;
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    load().then((data) => {
      if (cancelled || !data) return;
      const fresh = data.owner && !data.home && !data.completed_at && !data.dismissed_at && !data.paused;
      if (fresh) setOpen(true);
    });
    return () => { cancelled = true; };
  }, [load]);

  const leaveConsole = () => {
    clearConsoleBrokerage();
    onLeave?.();
    if (typeof window !== 'undefined') window.location.assign('/admin');
  };

  const strip = slug && setup && !setup.home ? (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm">
      <span>
        You’re in the console for <span className="font-semibold">{setup.brokerage?.name || slug}</span>.
        {setup.site?.url ? null : ' Connect a domain in Settings to give it its own address.'}
      </span>
      <button type="button" onClick={leaveConsole} className="min-h-[36px] px-3 rounded-md border border-white/40 hover:bg-white/10">
        Leave
      </button>
    </div>
  ) : null;

  if (!setup || setup.home) {
    return (
      <div className="mb-4 space-y-3 empty:hidden">
        <ConsoleNotes onConfirmed={load} />
        {strip}
      </div>
    );
  }

  const billing = setup.billing || {};
  const showSetupBanner = setup.owner && !setup.completed_at && !open && !setup.paused;

  const sendConfirm = async () => {
    setResend({ kind: 'busy' });
    try {
      const res = await resendOwnerConfirm(token);
      setResend({ kind: 'ok', text: res.already ? 'Your email is already confirmed.' : `Sent to ${res.to}.` });
      if (res.already) load();
    } catch (err) {
      setResend({ kind: 'error', text: err.message || 'Could not send the email' });
    }
  };

  const closeWizard = (why) => {
    setOpen(false);
    if (why === 'completed' || why === 'later') load();
  };

  return (
    <div className="mb-6 space-y-3">
      <ConsoleNotes onConfirmed={load} />
      {strip}

      {setup.paused && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50" role="dialog" aria-modal="true" aria-labelledby="paused-title">
          <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 space-y-5">
            <h1 id="paused-title" className="text-2xl sm:text-3xl font-bold text-gray-900">Your site is paused</h1>
            <p className="text-gray-600">
              The free trial for {setup.brokerage?.name || 'your brokerage'} ended without a payment method, so your site and
              alerts are paused. Nothing is deleted. Subscribe and everything comes back right away.
            </p>
            {setup.owner ? (
              <BillingCard token={token} />
            ) : (
              <p className="text-sm text-gray-600">Ask your brokerage’s owner to sign in and add a payment method.</p>
            )}
            <button type="button" onClick={() => load()} className="text-sm underline text-gray-600">I’ve paid, check again</button>
          </div>
        </div>
      )}

      {!setup.paused && billing.banner && setup.owner && (
        <Banner
          kind={billing.banner.kind}
          action={
            <button type="button" onClick={() => onOpenTab?.('settings')} className={bannerButton}>
              {billing.has_customer ? 'Update billing' : 'Add payment method'}
            </button>
          }
        >
          {billing.banner.text}
        </Banner>
      )}

      {showSetupBanner && (
        <Banner
          action={
            <button
              type="button"
              onClick={async () => {
                if (setup.dismissed_at) {
                  try {
                    const res = await patchOwnerSetup(token, { dismissed: false });
                    setSetup(res.data);
                  } catch {
                    /* still open the steps */
                  }
                }
                setOpen(true);
              }}
              className={bannerButton}
            >
              Finish setup
            </button>
          }
        >
          <p className="font-semibold text-gray-900">Finish setting up {setup.brokerage?.name || 'your brokerage'}</p>
          <p className="text-gray-600 mt-0.5">{setup.done_count} of {setup.order.length} steps done. Pick up where you left off.</p>
          <div className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-gray-900" style={{ width: `${Math.round((setup.done_count / setup.order.length) * 100)}%` }} />
          </div>
        </Banner>
      )}

      {!setup.email_confirmed && (
        <Banner
          action={
            <button type="button" onClick={sendConfirm} disabled={resend?.kind === 'busy'} className={bannerLink}>
              {resend?.kind === 'busy' ? 'Sending…' : 'Resend the email'}
            </button>
          }
        >
          <p>
            Please confirm your email: we sent you a link.
            {resend?.text ? <span className={`ml-1 ${resend.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>{resend.text}</span> : null}
          </p>
        </Banner>
      )}

      {open && !setup.paused && (
        <SetupWizard token={token} setup={setup} onChange={setSetup} onClose={closeWizard} onOpenTab={onOpenTab} />
      )}
    </div>
  );
}

/** Extra cards under Settings: Billing, what happens in Follow Up Boss, Embeds. */
export function OwnerSettingsExtras({ token }) {
  const [setup, setSetup] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getOwnerSetup(token)
      .then((res) => !cancelled && setSetup(res.data))
      .catch(() => !cancelled && setSetup(null));
    return () => { cancelled = true; };
  }, [token]);
  return (
    <>
      {setup && !setup.home && setup.owner && <BillingCard token={token} />}
      {setup && !setup.home && <FubAutomationCard fub={setup.fub} />}
      {setup && <EmbedsCard token={token} />}
    </>
  );
}
