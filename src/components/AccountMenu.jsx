import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { signOutApi, notifySavedHomesChanged } from "../utils/savedHomesApi.js";

/**
 * Header account dropdown for signed-in users.
 * Saved Homes · Notifications · Manage Alerts · My Home · Sign out
 */
export default function AccountMenu({
  email = null,
  unreadCount = 0,
  onSignOut = null,
  variant = "desktop", // desktop | mobile-inline
  onNavigate = null,
}) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSignOut = async (e) => {
    e?.preventDefault?.();
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOutApi();
      notifySavedHomesChanged({ signedIn: false });
      setOpen(false);
      onSignOut?.();
    } catch {
      /* still clear local UI */
      onSignOut?.();
    } finally {
      setSigningOut(false);
    }
  };

  const nav = (e) => {
    setOpen(false);
    onNavigate?.(e);
  };

  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const label = email
    ? email.includes("@")
      ? email.split("@")[0]
      : email
    : "Account";

  const links = [
    { to: "/my-saved-searches/", label: "Saved Homes", icon: "♥" },
    {
      to: "/notifications/",
      label: unreadCount > 0 ? `Notifications (${badgeLabel})` : "Notifications",
      icon: "🔔",
    },
    { to: "/my-saved-searches/", label: "Manage Alerts", icon: "⚙" },
    { to: "/my-home/", label: "My Home", icon: "⌂" },
  ];

  if (variant === "mobile-inline") {
    return (
      <div className="space-y-3 border-t border-gray-700 pt-6 mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {email || "Your account"}
        </p>
        {links.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            onClick={nav}
            className="block text-lg sm:text-xl hover:text-gray-300 transition-colors"
          >
            <span className="mr-2 opacity-70" aria-hidden="true">
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="block text-lg sm:text-xl text-gray-300 hover:text-white transition-colors text-left w-full disabled:opacity-50"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 hover:text-gray-200 transition-colors text-sm text-white min-h-[44px]"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Account menu"
      >
        <span className="max-w-[8rem] truncate">{label}</span>
        <span className="text-xs opacity-70" aria-hidden="true">
          ▾
        </span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-gray-700 bg-black shadow-2xl z-[60] overflow-hidden py-1"
          role="menu"
        >
          {email ? (
            <p className="px-4 py-2 text-[11px] text-gray-500 truncate border-b border-gray-800">
              {email}
            </p>
          ) : null}
          {links.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              role="menuitem"
              onClick={nav}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span className="text-[#CFB36E] w-4 text-center" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-gray-800" />
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <span className="text-[#CFB36E] w-4 text-center" aria-hidden="true">
              →
            </span>
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
