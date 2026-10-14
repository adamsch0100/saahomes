/**
 * Second sign-in step: the login answered { needs_2fa, challenge }.
 * Sends the authenticator code (or a recovery code) to /api/account/2fa/verify
 * and hands the normal login body ({ token, data? }) to onSuccess.
 */
import React, { useState } from 'react';
import { verifyTwoStepLogin } from '../../utils/api.js';

export default function TwoStepCodeForm({
  challenge,
  onSuccess,
  onCancel,
  buttonClassName = 'text-white bg-black hover:bg-gray-800',
}) {
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const value = code.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const response = await verifyTwoStepLogin(challenge, useRecovery ? value : value.replace(/\s+/g, ''));
      if (response?.token) {
        await onSuccess(response);
      } else {
        setError('Sign-in failed — no token returned');
      }
    } catch (err) {
      setError(err.message || 'That code did not work. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="two-step-code" className="block text-sm font-medium text-gray-700">
          {useRecovery
            ? 'Enter one of your recovery codes'
            : 'Enter the 6-digit code from your authenticator app'}
        </label>
        <input
          id="two-step-code"
          name="code"
          type="text"
          required
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecovery ? 'text' : 'numeric'}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-2 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-black focus:border-black sm:text-sm font-mono tracking-widest"
          placeholder={useRecovery ? 'abcd-efgh' : '123456'}
        />
        <button
          type="button"
          onClick={() => {
            setUseRecovery((v) => !v);
            setCode('');
            setError(null);
          }}
          className="mt-2 text-xs text-gray-500 hover:text-black underline underline-offset-2"
        >
          {useRecovery ? 'Use your authenticator app instead' : 'Use a recovery code'}
        </button>
      </div>
      <div className="space-y-3">
        <button
          type="submit"
          disabled={busy}
          className={`group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-50 ${buttonClassName}`}
        >
          {busy ? 'Checking…' : 'Verify'}
        </button>
        {onCancel && (
          <div className="text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-600 hover:text-black"
            >
              Back to sign in
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
