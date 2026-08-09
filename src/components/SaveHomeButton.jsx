import React, { useCallback, useEffect, useState } from "react";
import SignInToSaveModal from "./SignInToSaveModal";
import {
  fetchSessionUser,
  fetchSavedStatus,
  listingKeyOf,
  migrateLocalSavedHomes,
  notifySavedHomesChanged,
  saveHomeApi,
  unsaveHomeApi,
} from "../utils/savedHomesApi.js";
import { isHomeSaved as isLocalHomeSaved } from "../utils/listingHelpers.js";

/**
 * Account-linked heart button.
 * Logged in → POST/DELETE /api/saved-homes (optimistic UI).
 * Guest → SignInToSaveModal (email + phone).
 *
 * Props:
 *  - listing: listing object (preferred) OR listingKey / slug
 *  - saved: optional controlled saved state
 *  - onSavedChange: (bool) => void
 *  - className: button classes
 */
export default function SaveHomeButton({
  listing = null,
  listingKey: listingKeyProp = null,
  slug = null,
  saved: controlledSaved = null,
  onSavedChange = null,
  className = "",
  size = 20,
}) {
  const key =
    listingKeyProp ||
    listingKeyOf(listing) ||
    slug ||
    listing?.slug ||
    null;

  // Prefer listing_id for API; keep slug/id as fallbacks for status map
  const statusKeys = [
    listing?.listing_id,
    listing?.listing_key,
    listing?.slug,
    slug,
    listingKeyProp,
    listing?.id != null ? String(listing.id) : null,
  ].filter(Boolean).map(String);

  const [internalSaved, setInternalSaved] = useState(() => {
    if (controlledSaved != null) return Boolean(controlledSaved);
    // Guest fallback: legacy localStorage until first login migration
    if (slug) return isLocalHomeSaved(slug);
    if (listing?.slug) return isLocalHomeSaved(listing.slug);
    return false;
  });
  const [signedIn, setSignedIn] = useState(null); // null checking | true | false
  const [loginOpen, setLoginOpen] = useState(false);
  const [pendingAfterLogin, setPendingAfterLogin] = useState(false);

  // Always render from internal (supports optimistic UI); parent batch pre-fills via prop
  const saved = internalSaved;

  const setSaved = useCallback(
    (next) => {
      setInternalSaved(next);
      onSavedChange?.(next);
    },
    [onSavedChange]
  );

  // Session check + optional status for this key
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    (async () => {
      const user = await fetchSessionUser();
      if (cancelled) return;
      if (!user) {
        setSignedIn(false);
        // localStorage fallback for guests
        if (controlledSaved == null) {
          const local = statusKeys.some((k) => isLocalHomeSaved(k));
          setInternalSaved(local);
        }
        return;
      }
      setSignedIn(true);
      await migrateLocalSavedHomes();
      if (cancelled) return;
      const map = await fetchSavedStatus(statusKeys.length ? statusKeys : [key]);
      if (cancelled) return;
      const isSaved = statusKeys.some((k) => map[k]) || Boolean(map[String(key)]);
      if (controlledSaved == null) setInternalSaved(isSaved);
      // Don't call onSavedChange on mount-only hydrate unless parent wants it —
      // parent batch status usually owns multi-card state.
      if (controlledSaved == null && onSavedChange) onSavedChange(isSaved);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run when identity key changes
  }, [key]);

  // External updates (batch status / other hearts)
  useEffect(() => {
    if (controlledSaved != null) return undefined;
    const onChange = (e) => {
      const d = e?.detail || {};
      if (d.listingKey && statusKeys.includes(String(d.listingKey))) {
        if (typeof d.saved === "boolean") setInternalSaved(d.saved);
      } else if (d.signedIn) {
        // re-check after login from another button
        fetchSavedStatus(statusKeys.length ? statusKeys : [key]).then((map) => {
          const isSaved = statusKeys.some((k) => map[k]) || Boolean(map[String(key)]);
          setInternalSaved(isSaved);
        });
        setSignedIn(true);
      }
    };
    window.addEventListener("saa-saved-homes-changed", onChange);
    return () => window.removeEventListener("saa-saved-homes-changed", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, controlledSaved]);

  // Sync controlled prop
  useEffect(() => {
    if (controlledSaved != null) setInternalSaved(Boolean(controlledSaved));
  }, [controlledSaved]);

  const toggle = async (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!key) return;

    if (signedIn === false) {
      setPendingAfterLogin(true);
      setLoginOpen(true);
      return;
    }

    // signedIn null → treat as may be signed in; try API and handle 401
    const next = !saved;
    setSaved(next); // optimistic
    try {
      if (next) {
        const data = await saveHomeApi(key);
        const canonical = data?.listing_key || key;
        notifySavedHomesChanged({ listingKey: canonical, saved: true });
        statusKeys.forEach((k) => notifySavedHomesChanged({ listingKey: k, saved: true }));
      } else {
        await unsaveHomeApi(key);
        notifySavedHomesChanged({ listingKey: key, saved: false });
        statusKeys.forEach((k) => notifySavedHomesChanged({ listingKey: k, saved: false }));
      }
      setSignedIn(true);
    } catch (err) {
      setSaved(!next); // revert
      if (err?.status === 401) {
        setSignedIn(false);
        setPendingAfterLogin(true);
        setLoginOpen(true);
      }
    }
  };

  const afterLogin = async () => {
    setSignedIn(true);
    if (!pendingAfterLogin || !key) return;
    setPendingAfterLogin(false);
    setSaved(true);
    try {
      await saveHomeApi(key);
      notifySavedHomesChanged({ listingKey: key, saved: true });
    } catch {
      setSaved(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label={saved ? "Remove from saved homes" : "Save this home"}
        aria-pressed={saved}
        title={saved ? "Saved" : "Save home"}
        onClick={toggle}
        className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-white/95 shadow-md border border-black/5 hover:scale-105 active:scale-95 transition-transform touch-manipulation ${className}`}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill={saved ? "#CFB36E" : "none"}
          stroke={saved ? "#CFB36E" : "#111"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <SignInToSaveModal
        open={loginOpen}
        onClose={() => {
          setLoginOpen(false);
          setPendingAfterLogin(false);
        }}
        onSuccess={afterLogin}
      />
    </>
  );
}

/**
 * Hook for batch heart status on a results list.
 * Returns { savedMap, refresh, signedIn }.
 */
export function useSavedHomesStatus(listings = []) {
  const [savedMap, setSavedMap] = useState({});
  const [signedIn, setSignedIn] = useState(null);

  const refresh = useCallback(async (rows = listings) => {
    const keys = [];
    for (const l of rows || []) {
      if (!l) continue;
      if (l.listing_id) keys.push(String(l.listing_id));
      if (l.slug) keys.push(String(l.slug));
      if (l.id != null) keys.push(String(l.id));
    }
    if (!keys.length) {
      setSavedMap({});
      return {};
    }
    const user = await fetchSessionUser();
    if (!user) {
      setSignedIn(false);
      // Guest: localStorage
      const local = {};
      for (const k of keys) local[k] = isLocalHomeSaved(k);
      setSavedMap(local);
      return local;
    }
    setSignedIn(true);
    await migrateLocalSavedHomes();
    const map = await fetchSavedStatus(keys);
    setSavedMap(map);
    return map;
  }, [listings]);

  useEffect(() => {
    refresh(listings);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when listing identity set changes
  }, [
    // stringify ids for stable compare
    (listings || [])
      .map((l) => l?.listing_id || l?.slug || l?.id)
      .filter(Boolean)
      .join(","),
  ]);

  useEffect(() => {
    const onChange = () => refresh(listings);
    window.addEventListener("saa-saved-homes-changed", onChange);
    return () => window.removeEventListener("saa-saved-homes-changed", onChange);
  }, [refresh, listings]);

  return { savedMap, refresh, signedIn };
}
