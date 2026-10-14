/**
 * /reset-password?token=… — password reset AND staff invites (purpose 'invite').
 * Checks the token, lets the person choose a password, then points them at
 * the right sign-in (admin → /admin/, agent → /agent/, everyone else → /).
 */
import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SEO from '../components/SEO';
import ForgotPassword from '../components/account/ForgotPassword.jsx';
import { checkPasswordResetToken, confirmPasswordReset } from '../utils/api.js';

const MIN_LENGTH = 8;

const DONE_LINKS = {
  admin: { to: '/admin/', label: 'Go to admin sign in' },
  agent: { to: '/agent/', label: 'Go to the agent console' },
};

const inputClass =
  'mt-1 appearance-none block w-full px-3 py-2 min-h-[44px] border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-black focus:border-black sm:text-sm';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [phase, setPhase] = useState(token ? 'checking' : 'invalid'); // checking | form | invalid | done
  const [info, setInfo] = useState(null); // { purpose, email, name, brokerage }
  const [invalidMessage, setInvalidMessage] = useState(
    token ? null : 'This link is missing its token. Request a new one below.'
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [doneRole, setDoneRole] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPhase('checking');
    (async () => {
      try {
        const res = await checkPasswordResetToken(token);
        if (cancelled) return;
        setInfo({
          purpose: res.purpose === 'invite' ? 'invite' : 'reset',
          email: res.email || '',
          name: res.name || '',
          brokerage: res.brokerage || '',
        });
        setPhase('form');
      } catch (err) {
        if (cancelled) return;
        setInvalidMessage(err.message || 'This link has expired or was already used.');
        setPhase('invalid');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.');
      return;
    }
    setBusy(true);
    try {
      const res = await confirmPasswordReset(token, password);
      setDoneRole(res.role || null);
      setPassword('');
      setConfirm('');
      setPhase('done');
    } catch (err) {
      setError(err.message || 'Could not set your password. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isInvite = info?.purpose === 'invite';
  const firstName = (info?.name || '').trim().split(/\s+/)[0];
  const doneLink = DONE_LINKS[doneRole] || { to: '/', label: 'Back to the home page' };

  return (
    <>
      <SEO
        title={isInvite ? 'Set your password' : 'Reset your password'}
        description="Set or reset your account password"
        robots="noindex, nofollow"
      />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {phase === 'checking' && (
            <div className="space-y-3" aria-busy="true">
              <div className="h-8 w-2/3 mx-auto bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 rounded animate-pulse" />
            </div>
          )}

          {phase === 'form' && info && (
            <>
              <div className="text-center">
                {isInvite && info.brokerage && (
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--brand-accent)' }}>
                    Join {info.brokerage}
                  </p>
                )}
                <h2 className="mt-2 text-3xl font-extrabold text-gray-900">
                  {isInvite ? 'Set your password' : 'Choose a new password'}
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  {isInvite
                    ? `${firstName ? `Hi ${firstName} — ` : ''}pick a password to finish setting up your account${
                        info.email ? ` (${info.email})` : ''
                      }.`
                    : info.email
                      ? `For ${info.email}`
                      : 'Pick something you haven’t used before.'}
                </p>
              </div>
              <form className="space-y-6" onSubmit={handleSubmit}>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">{error}</div>
                )}
                {/* Hidden username helps password managers save the right account */}
                {info.email && (
                  <input type="email" name="username" autoComplete="username" value={info.email} readOnly hidden />
                )}
                <div className="space-y-4">
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">New password</span>
                    <input
                      type="password"
                      required
                      minLength={MIN_LENGTH}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      placeholder={`At least ${MIN_LENGTH} characters`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-gray-700">Confirm password</span>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className={inputClass}
                      placeholder="Type it again"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={busy}
                  className="group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-black hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50"
                >
                  {busy ? 'Saving…' : isInvite ? 'Set password' : 'Save new password'}
                </button>
              </form>
              {error && (
                <ForgotPassword linkLabel="Link expired? Request a new one" buttonLabel="Send a new link" />
              )}
            </>
          )}

          {phase === 'done' && (
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-extrabold text-gray-900">
                {isInvite ? 'You’re all set' : 'Password updated'}
              </h2>
              <p className="text-sm text-gray-600">
                {isInvite
                  ? `Your password is set${info?.brokerage ? ` and your ${info.brokerage} account is ready` : ''}.`
                  : 'Your new password is saved. Use it next time you sign in.'}
              </p>
              <Link
                to={doneLink.to}
                className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-md text-sm font-medium text-white bg-black hover:bg-gray-800"
              >
                {doneLink.label}
              </Link>
            </div>
          )}

          {phase === 'invalid' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-3xl font-extrabold text-gray-900">This link doesn’t work</h2>
                <p className="mt-2 text-sm text-gray-600">{invalidMessage}</p>
                <p className="mt-1 text-sm text-gray-500">
                  Reset and invite links expire and can only be used once. Enter your email and we’ll send a fresh one.
                </p>
              </div>
              <ForgotPassword alwaysOpen buttonLabel="Send a new link" />
              <p className="text-center text-sm">
                <Link to="/" className="text-gray-600 hover:text-black underline underline-offset-2">
                  Back to the home page
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
