import React, { useEffect, useState } from "react";
import {
  canPromptInstall,
  disablePush,
  enablePush,
  needsHomeScreenFirst,
  onInstallAvailable,
  promptInstall,
  pushState,
  isStandalone,
} from "../utils/push.js";

/**
 * "Get instant alerts on this phone" — web push opt-in plus app install.
 * Only for a signed-in client (the subscription is saved to their account).
 * compact: one-line version for tight spots like the save-search modal.
 */
export default function InstantAlertsCard({ compact = false, className = "" }) {
  const [status, setStatus] = useState("checking"); // checking | on | off | blocked | unsupported
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [installable, setInstallable] = useState(canPromptInstall());

  useEffect(() => {
    let live = true;
    pushState().then((s) => live && setStatus(s)).catch(() => live && setStatus("unsupported"));
    const off = onInstallAvailable((v) => setInstallable(v));
    return () => {
      live = false;
      off();
    };
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setError("");
    try {
      await enablePush();
      setStatus("on");
    } catch (e) {
      setError(e.message);
      setStatus(await pushState().catch(() => "off"));
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    await disablePush();
    setStatus("off");
    setBusy(false);
  };

  if (status === "checking") return null;

  const shell = `rounded-xl border border-[#CFB36E]/50 bg-[#CFB36E]/10 text-left ${compact ? "px-3.5 py-3" : "p-4"} ${className}`;
  const installButton = installable && !isStandalone() ? (
    <button
      type="button"
      onClick={() => promptInstall().then(() => setInstallable(canPromptInstall()))}
      className="mt-2 text-xs font-semibold underline text-gray-800"
    >
      Add SAA Homes to your home screen
    </button>
  ) : null;

  if (needsHomeScreenFirst()) {
    return (
      <div className={shell}>
        <p className="text-sm font-semibold text-gray-900">Get instant alerts on your iPhone</p>
        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
          Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Open SAA Homes from your home screen and
          turn on alerts there. New matches and price drops show up the moment we see them.
        </p>
      </div>
    );
  }

  if (status === "unsupported") {
    return installButton ? <div className={shell}>{installButton}</div> : null;
  }

  if (status === "on") {
    return (
      <div className={shell}>
        <p className="text-sm font-semibold text-gray-900">Instant alerts are on for this device</p>
        {!compact && (
          <p className="text-xs text-gray-700 mt-1 leading-relaxed">
            New matches and price drops arrive as a notification, never between 9pm and 8am, and no more than a few a day.
          </p>
        )}
        <button type="button" onClick={turnOff} disabled={busy} className="mt-1.5 text-xs text-gray-600 underline">
          Turn off on this device
        </button>
        {installButton}
      </div>
    );
  }

  if (status === "blocked") {
    return (
      <div className={shell}>
        <p className="text-sm font-semibold text-gray-900">Notifications are blocked</p>
        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
          Allow notifications for saahomes.com in your browser settings, then come back here to turn on instant alerts.
        </p>
      </div>
    );
  }

  return (
    <div className={shell}>
      <p className="text-sm font-semibold text-gray-900">Be first to new listings</p>
      {!compact && (
        <p className="text-xs text-gray-700 mt-1 leading-relaxed">
          Get a notification on this device the moment a home matches your search or a saved home drops its price.
          Quiet overnight, and a few a day at most.
        </p>
      )}
      <button
        type="button"
        onClick={turnOn}
        disabled={busy}
        className="mt-2.5 inline-flex items-center justify-center w-full py-2.5 bg-black text-white text-sm font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {busy ? "Turning on…" : "Turn on instant alerts"}
      </button>
      {error && <p className="text-xs text-red-700 mt-2">{error}</p>}
      {installButton}
    </div>
  );
}
