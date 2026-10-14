/**
 * Two-step sign-in settings for signed-in staff (admin or agent token).
 * off → setup (QR + secret + confirm code) → just enabled (recovery codes, shown once) → on.
 *
 * `required`: the brokerage requires two-step sign-in and this account must set
 * it up before anything else works. `onEnabled(res)` gets the enable response
 * (its `token`, when present, replaces the setup-only token); `onDone()` runs
 * once the recovery codes are acknowledged (or when it's already on).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  getTwoStepStatus,
  setupTwoStep,
  enableTwoStep,
  disableTwoStep,
} from '../../utils/api.js';

const GOLD = 'var(--brand-accent)';

function formatSince(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TwoStepPanel({ token, required = false, onEnabled, onDone }) {
  const [status, setStatus] = useState(null); // { enabled, enabled_at }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [setup, setSetup] = useState(null); // { secret, otpauth_url, qr_data_url }
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [copyMsg, setCopyMsg] = useState(null);
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getTwoStepStatus(token);
      setStatus({ enabled: !!res.enabled, enabled_at: res.enabled_at || null });
    } catch (err) {
      setError(err.message || 'Could not load two-step sign-in settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const startSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await setupTwoStep(token);
      setSetup({ secret: res.secret, otpauth_url: res.otpauth_url, qr_data_url: res.qr_data_url || null });
      setCode('');
    } catch (err) {
      setError(err.message || 'Could not start setup');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await enableTwoStep(token, code.replace(/\s+/g, ''));
      if (onEnabled) onEnabled(res);
      setRecoveryCodes(res.recovery_codes || []);
      setSetup(null);
      setCode('');
      setStatus({ enabled: true, enabled_at: new Date().toISOString() });
    } catch (err) {
      setError(err.message || 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await disableTwoStep(token, code.trim());
      setDisabling(false);
      setCode('');
      setStatus({ enabled: false, enabled_at: null });
    } catch (err) {
      setError(err.message || 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText((recoveryCodes || []).join('\n'));
      setCopyMsg('Copied');
    } catch {
      setCopyMsg('Copy failed — select and copy manually');
    }
    setTimeout(() => setCopyMsg(null), 2500);
  };

  const cancel = () => {
    setSetup(null);
    setDisabling(false);
    setCode('');
    setError(null);
  };

  const inputClass =
    'w-full sm:w-48 min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-black';
  const primaryClass = 'min-h-[44px] px-5 rounded-lg text-sm font-semibold text-[color:var(--brand-on-accent)] disabled:opacity-50';
  const secondaryClass =
    'min-h-[44px] px-4 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:border-black disabled:opacity-50';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Two-step sign-in</h2>
          <p className="text-sm text-gray-500 mt-1">
            After your password, ask for a code from an authenticator app (Google Authenticator, 1Password, Authy).
          </p>
        </div>
        {status && !recoveryCodes && (
          <span
            className={`self-start text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
              status.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {status.enabled ? 'On' : 'Off'}
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {required && !status?.enabled && (
          <p className="text-sm font-semibold text-gray-900">
            Your brokerage requires two-step sign-in. Set it up to continue.
          </p>
        )}

        {loading && !status && (
          <div className="space-y-3" aria-busy="true">
            <div className="h-10 rounded-lg bg-gray-100 animate-pulse" />
          </div>
        )}

        {/* Just enabled — recovery codes, shown once */}
        {recoveryCodes && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900">Two-step sign-in is on.</p>
            <p className="text-sm text-gray-600">
              These recovery codes each work once if you lose your phone. They won&apos;t be shown again — save these
              somewhere safe.
            </p>
            <ul className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-gray-200 bg-gray-50 font-mono text-sm text-gray-900">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={copyCodes} className={primaryClass} style={{ backgroundColor: GOLD }}>
                Copy codes
              </button>
              <button
                type="button"
                onClick={() => {
                  setRecoveryCodes(null);
                  if (onDone) onDone();
                }}
                className={secondaryClass}
              >
                {onDone ? 'I saved them — continue' : 'I saved them'}
              </button>
              {copyMsg && <span className="text-sm text-gray-600">{copyMsg}</span>}
            </div>
          </div>
        )}

        {/* Off */}
        {status && !status.enabled && !setup && !recoveryCodes && (
          <button type="button" onClick={startSetup} disabled={busy} className={primaryClass} style={{ backgroundColor: GOLD }}>
            {busy ? 'Starting…' : 'Turn on'}
          </button>
        )}

        {/* Setup */}
        {setup && (
          <form onSubmit={confirmEnable} className="space-y-4">
            <p className="text-sm text-gray-600">
              1. Scan this with your authenticator app{setup.qr_data_url ? '' : ' (or add the key below by hand)'}.
            </p>
            {setup.qr_data_url && (
              <img
                src={setup.qr_data_url}
                alt="QR code for your authenticator app"
                width={180}
                height={180}
                className="border border-gray-200 rounded-lg"
              />
            )}
            <div>
              <p className="text-xs font-medium text-gray-600">Can&apos;t scan? Enter this key manually:</p>
              <code className="mt-1 inline-block px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm font-mono text-gray-900 break-all select-all">
                {setup.secret}
              </code>
            </div>
            <label className="block">
              <span className="text-sm text-gray-600">2. Enter the 6-digit code it shows to confirm.</span>
              <input
                type="text"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`mt-2 block ${inputClass}`}
                placeholder="123456"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy} className={primaryClass} style={{ backgroundColor: GOLD }}>
                {busy ? 'Checking…' : 'Confirm and turn on'}
              </button>
              <button type="button" onClick={cancel} disabled={busy} className={secondaryClass}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* On */}
        {status?.enabled && !recoveryCodes && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              On{formatSince(status.enabled_at) ? ` since ${formatSince(status.enabled_at)}` : ''}. You&apos;ll be asked
              for a code each time you sign in.
            </p>
            {required && onDone ? (
              <button type="button" onClick={onDone} className={primaryClass} style={{ backgroundColor: GOLD }}>
                Continue
              </button>
            ) : !disabling ? (
              <button
                type="button"
                onClick={() => {
                  setDisabling(true);
                  setCode('');
                  setError(null);
                }}
                className={secondaryClass}
              >
                Turn off
              </button>
            ) : (
              <form onSubmit={confirmDisable} className="space-y-3">
                <label className="block">
                  <span className="text-sm text-gray-600">
                    Enter a current code from your authenticator app to turn it off.
                  </span>
                  <input
                    type="text"
                    required
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`mt-2 block ${inputClass}`}
                    placeholder="123456"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-[44px] px-5 rounded-lg bg-black text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? 'Turning off…' : 'Turn off'}
                  </button>
                  <button type="button" onClick={cancel} disabled={busy} className={secondaryClass}>
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>
        )}

        {!status && !loading && error && (
          <button type="button" onClick={load} className={secondaryClass}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
