import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  dismissNotification,
  dismissAllNotifications,
  relativeTime,
  notificationImageSrc,
  NOTIFICATION_TYPE_LABELS,
} from "../utils/notificationsApi.js";
import { fetchSessionUser } from "../utils/savedHomesApi.js";

const GOLD = "#CFB36E";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "price_drop", label: "Price Drops" },
  { key: "new_match", label: "New Matches" },
  { key: "value_update", label: "Value Updates" },
];

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function groupByDate(items) {
  const today = startOfLocalDay(new Date());
  const yesterday = today - 86400000;
  const groups = { Today: [], Yesterday: [], Earlier: [] };
  for (const item of items) {
    const t = startOfLocalDay(item.created_at || 0);
    if (t === today) groups.Today.push(item);
    else if (t === yesterday) groups.Yesterday.push(item);
    else groups.Earlier.push(item);
  }
  return Object.entries(groups).filter(([, list]) => list.length > 0);
}

function SkeletonRow() {
  return (
    <div className="flex gap-4 p-4 border-b border-gray-100 animate-pulse">
      <div className="w-14 h-14 rounded-lg bg-gray-200 shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  );
}

function TypeBadge({ type }) {
  const label = NOTIFICATION_TYPE_LABELS[type] || type;
  const styles = {
    new_match: "bg-emerald-50 text-emerald-800 border-emerald-200",
    price_drop: "bg-amber-50 text-amber-900 border-amber-200",
    value_update: "bg-sky-50 text-sky-900 border-sky-200",
    off_market: "bg-gray-100 text-gray-700 border-gray-200",
    showing_confirm: "bg-violet-50 text-violet-900 border-violet-200",
    shared_home: "bg-[#CFB36E]/15 text-[#8a7020] border-[#CFB36E]/40",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
        styles[type] || "bg-gray-50 text-gray-700 border-gray-200"
      }`}
    >
      {label}
    </span>
  );
}

function NotificationRow({ item, onOpen, onMarkRead, onDismiss, busyId }) {
  const img = notificationImageSrc(item.image_url);
  const unread = item.unread || !item.read_at;
  const busy = busyId === item.id;

  return (
    <div
      className={`flex gap-3 sm:gap-4 p-4 border-b border-gray-100 hover:bg-gray-50/80 transition-colors ${
        unread ? "bg-[#CFB36E]/[0.06] border-l-[3px] border-l-[#CFB36E]" : "border-l-[3px] border-l-transparent"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0"
        aria-label={`Open: ${item.title}`}
      >
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-lg">🏠</div>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button type="button" onClick={() => onOpen(item)} className="w-full text-left">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <TypeBadge type={item.type} />
            <span className="text-xs text-gray-400">{relativeTime(item.created_at)}</span>
          </div>
          <p className={`text-sm sm:text-base leading-snug ${unread ? "font-semibold text-gray-900" : "text-gray-800"}`}>
            {item.title}
          </p>
          {item.body ? (
            <p className="text-sm text-gray-600 mt-1 leading-relaxed line-clamp-3">{item.body}</p>
          ) : null}
        </button>

        <div className="flex flex-wrap gap-3 mt-2">
          {unread ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMarkRead(item)}
              className="text-xs font-medium text-gray-600 hover:text-black disabled:opacity-50"
            >
              Mark read
            </button>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={() => onDismiss(item)}
            className="text-xs font-medium text-gray-500 hover:text-red-700 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationCenterPage() {
  const [signedIn, setSignedIn] = useState(null); // null = checking
  const [filter, setFilter] = useState("all");
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (nextFilter = filter, nextPage = 1, append = false) => {
    if (nextPage === 1) setLoading(true);
    else setLoadingMore(true);
    setError(null);
    try {
      const user = await fetchSessionUser();
      if (!user) {
        setSignedIn(false);
        setItems([]);
        setUnreadCount(0);
        return;
      }
      setSignedIn(true);
      const data = await fetchNotifications({ page: nextPage, filter: nextFilter });
      setUnreadCount(data.unread_count || 0);
      setHasMore(!!data.has_more);
      setPage(nextPage);
      setItems((prev) => (append ? [...prev, ...(data.notifications || [])] : data.notifications || []));
    } catch (e) {
      if (e?.status === 401) {
        setSignedIn(false);
        setItems([]);
      } else {
        setError(e.message || "Could not load notifications.");
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    load(filter, 1, false);
  }, [filter, load]);

  const groups = useMemo(() => groupByDate(items), [items]);

  const onOpen = (item) => {
    if (item?.id && (item.unread || !item.read_at)) {
      markNotificationRead(item.id)
        .then(() => {
          setItems((list) =>
            list.map((n) =>
              n.id === item.id ? { ...n, read_at: new Date().toISOString(), unread: false } : n
            )
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        })
        .catch(() => {});
    }
    window.location.href = item?.link || "/notifications/";
  };

  const onMarkRead = async (item) => {
    setBusyId(item.id);
    const prev = items;
    const prevUnread = unreadCount;
    setItems((list) =>
      list.map((n) =>
        n.id === item.id ? { ...n, read_at: new Date().toISOString(), unread: false } : n
      )
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await markNotificationRead(item.id);
    } catch {
      setItems(prev);
      setUnreadCount(prevUnread);
    } finally {
      setBusyId(null);
    }
  };

  const onDismiss = async (item) => {
    setBusyId(item.id);
    const prev = items;
    const prevUnread = unreadCount;
    const wasUnread = item.unread || !item.read_at;
    setItems((list) => list.filter((n) => n.id !== item.id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await dismissNotification(item.id);
    } catch {
      setItems(prev);
      setUnreadCount(prevUnread);
    } finally {
      setBusyId(null);
    }
  };

  const onMarkAll = async () => {
    if (bulkBusy || unreadCount === 0) return;
    setBulkBusy(true);
    const prev = items;
    const prevUnread = unreadCount;
    setItems((list) =>
      list.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString(), unread: false }))
    );
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      setItems(prev);
      setUnreadCount(prevUnread);
    } finally {
      setBulkBusy(false);
    }
  };

  const onDismissAll = async () => {
    if (bulkBusy || items.length === 0) return;
    if (!window.confirm("Dismiss all notifications? You can still get new ones from alerts.")) return;
    setBulkBusy(true);
    const prev = items;
    const prevUnread = unreadCount;
    setItems([]);
    setUnreadCount(0);
    try {
      await dismissAllNotifications();
    } catch {
      setItems(prev);
      setUnreadCount(prevUnread);
    } finally {
      setBulkBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pt-[var(--saa-header-h,5rem)] pb-16">
      <SEO
        title="Notifications | SAA Homes"
        description="Your home search alerts, price drops, and value updates from SAA Homes."
        canonical="https://saahomes.com/notifications/"
        robots="noindex, nofollow"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Notifications
            </h1>
            {signedIn && unreadCount > 0 ? (
              <p className="text-sm text-gray-500 mt-1">
                {unreadCount} unread
              </p>
            ) : null}
          </div>
          {signedIn ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onMarkAll}
                disabled={bulkBusy || unreadCount === 0}
                className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:opacity-40"
              >
                Mark all as read
              </button>
              <button
                type="button"
                onClick={onDismissAll}
                disabled={bulkBusy || items.length === 0}
                className="px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40"
              >
                Dismiss all
              </button>
            </div>
          ) : null}
        </div>

        {signedIn === false ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 sm:p-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-gray-900 mb-2">Sign in to see notifications</p>
            <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
              Save a home search or heart a listing — we&apos;ll surface new matches, price drops, and value updates here.
            </p>
            <Link
              to="/properties/"
              className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-bold text-black"
              style={{ backgroundColor: GOLD }}
            >
              Browse homes &amp; sign in
            </Link>
          </div>
        ) : (
          <>
            {/* Filter tabs */}
            <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-thin">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                      active
                        ? "bg-black text-white"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-gray-400"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : error ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-red-700 mb-3">{error}</p>
                  <button
                    type="button"
                    onClick={() => load(filter, 1, false)}
                    className="text-sm font-semibold underline"
                  >
                    Try again
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 sm:p-12 text-center">
                  <p className="text-base font-semibold text-gray-900 mb-2">
                    {filter === "all" ? "No notifications yet" : "Nothing in this filter"}
                  </p>
                  <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto">
                    Save a home search or check your home value — we&apos;ll keep you posted when something changes.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                      to="/properties/"
                      className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-bold text-black"
                      style={{ backgroundColor: GOLD }}
                    >
                      Save a home search
                    </Link>
                    <Link
                      to="/my-home/"
                      className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"
                    >
                      Check your home value
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {groups.map(([label, list]) => (
                    <div key={label}>
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          {label}
                        </h2>
                      </div>
                      {list.map((item) => (
                        <NotificationRow
                          key={item.id}
                          item={item}
                          onOpen={onOpen}
                          onMarkRead={onMarkRead}
                          onDismiss={onDismiss}
                          busyId={busyId}
                        />
                      ))}
                    </div>
                  ))}
                  {hasMore ? (
                    <div className="p-4 text-center border-t border-gray-100">
                      <button
                        type="button"
                        disabled={loadingMore}
                        onClick={() => load(filter, page + 1, true)}
                        className="text-sm font-semibold text-gray-800 hover:underline disabled:opacity-50"
                      >
                        {loadingMore ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              <Link to="/my-saved-searches/" className="underline hover:text-gray-600">
                Manage saved searches
              </Link>
              {" · "}
              <Link to="/my-home/" className="underline hover:text-gray-600">
                My home value
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
