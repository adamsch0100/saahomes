/**
 * "Forgot password?" — asks for an email and requests a reset link.
 * The backend never says whether the email exists, so neither do we.
 * Collapsed behind a link on login forms; `alwaysOpen` shows the form directly.
 */
import React, { useState } from 'react';
import { requestPasswordReset } from '../../utils/api.js';

const SENT_MESSAGE = 'If that email has an account, a reset link is on its way.';

export default function ForgotPassword({
  initialEmail = '',
  alwaysOpen = false,
  linkLabel = 'Forgot password?',
  buttonLabel = 'Send reset link',
  buttonClassName = 'bg-black text-white hover:bg-gray-800',
}) {
  const [open, setOpen] = useState(alwaysOpen);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.message || 'Could not send a reset link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            if (!email && initialEmail) setEmail(initialEmail);
            setOpen(true);
          }}
          className="text-sm text-gray-600 hover:text-black underline underline-offset-2"
        >
          {linkLabel}
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        {SENT_MESSAGE}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Your email</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full min-h-[44px] border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
          placeholder="you@example.com"
        />
      </label>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">{error}</div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className={`min-h-[44px] px-5 rounded-lg text-sm font-semibold disabled:opacity-50 ${buttonClassName}`}
        >
          {busy ? 'Sending…' : buttonLabel}
        </button>
        {!alwaysOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-600 hover:text-black"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
