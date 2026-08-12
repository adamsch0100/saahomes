import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchSessionUser } from "../utils/savedHomesApi.js";
import {
  fetchUnreadSummary,
  markNotificationRead,
  markAllNotificationsRead,
  relativeTime,
  notificationImageSrc,
} from "../utils/notificationsApi.js";
import AccountModal from "./AccountModal";
import AccountMenu from "./AccountMenu";

const buyerProgramLinks = [
  { label: "CHFA Down Payment Assistance", to: "/chfa-down-payment-assistance/" },
  { label: "Down Payment Assistance", to: "/chfa-down-payment-assistance/#city-county-programs" },
  { label: "G-HOPE Greeley (City Employees)", to: "/greeley-g-hope-down-payment-assistance/" },
  { label: "CHFA Schools To Home", to: "/chfa-schools-to-home/" },
  { label: "Champions Home Loan", to: "/colorado-champions-home-loan-program/" },
];

const POLL_MS = 60_000;

function BellIcon({ className = "w-5 h-5" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function NotificationDropdownRow({ item, onOpen }) {
  const img = notificationImageSrc(item.image_url);
  const unread = item.unread || !item.read_at;
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`w-full text-left flex gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors ${
        unread ? "border-l-2 border-[#CFB36E]" : "border-l-2 border-transparent"
      }`}
    >
      <div className="w-10 h-10 rounded overflow-hidden bg-gray-800 shrink-0">
        {img ? (
          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#CFB36E]">
            <BellIcon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug truncate ${unread ? "font-semibold text-white" : "text-gray-200"}`}>
          {item.title}
        </p>
        {item.body ? (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-snug">{item.body}</p>
        ) : null}
        <p className="text-[11px] text-gray-500 mt-1">{relativeTime(item.created_at)}</p>
      </div>
    </button>
  );
}

export default function Header() {
  const location = useLocation();
  const headerRef = useRef(null);
  const bellRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [buyersExpanded, setBuyersExpanded] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [sessionEmail, setSessionEmail] = useState(null);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previewItems, setPreviewItems] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  // Multi-agent seats: show console link when agent (or admin) token is present
  const [hasAgentConsole, setHasAgentConsole] = useState(() => {
    try {
      return !!(localStorage.getItem('agentToken') || localStorage.getItem('adminToken'));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const refreshConsoleFlag = () => {
      try {
        setHasAgentConsole(!!(localStorage.getItem('agentToken') || localStorage.getItem('adminToken')));
      } catch {
        setHasAgentConsole(false);
      }
    };
    refreshConsoleFlag();
    window.addEventListener('storage', refreshConsoleFlag);
    return () => window.removeEventListener('storage', refreshConsoleFlag);
  }, [location.pathname]);

  // Compact always-black header on full-screen search (Zillow-style)
  const isSearchHeader =
    location.pathname === "/properties" || location.pathname === "/properties/";

  const closeMenu = () => {
    setMenuOpen(false);
    setBuyersExpanded(false);
  };

  const refreshNotifications = useCallback(async () => {
    const user = await fetchSessionUser();
    if (!user) {
      setSignedIn(false);
      setSessionEmail(null);
      setUnreadCount(0);
      setPreviewItems([]);
      return;
    }
    setSignedIn(true);
    setSessionEmail(user.email || null);
    const summary = await fetchUnreadSummary();
    if (!summary) {
      setUnreadCount(0);
      setPreviewItems([]);
      return;
    }
    setUnreadCount(summary.unread_count || 0);
    setPreviewItems(summary.notifications || []);
  }, []);

  useEffect(() => {
    refreshNotifications();
    const id = setInterval(refreshNotifications, POLL_MS);
    return () => clearInterval(id);
  }, [refreshNotifications, location.pathname]);

  // Re-check session when hearts/account change elsewhere
  useEffect(() => {
    const onChange = (e) => {
      const d = e?.detail || {};
      if (d.signedIn === false) {
        setSignedIn(false);
        setSessionEmail(null);
        setUnreadCount(0);
        setPreviewItems([]);
        return;
      }
      refreshNotifications();
    };
    window.addEventListener("saa-saved-homes-changed", onChange);
    return () => window.removeEventListener("saa-saved-homes-changed", onChange);
  }, [refreshNotifications]);

  const handleAccountSignedIn = () => {
    setAccountModalOpen(false);
    refreshNotifications();
  };

  const handleSignedOut = () => {
    setSignedIn(false);
    setSessionEmail(null);
    setUnreadCount(0);
    setPreviewItems([]);
    closeMenu();
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // On properties search page body overflow is managed by PropertiesPage;
    // only lock when opening the menu off that page (or force lock for menu).
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else if (!isSearchHeader) {
      document.body.style.overflow = "";
    }
    return () => {
      if (!isSearchHeader) {
        document.body.style.overflow = "";
      }
    };
  }, [menuOpen, isSearchHeader]);

  // Publish header height so the search app can pin under it (incl. safe-area)
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return undefined;

    const publish = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--saa-header-h", `${h}px`);
    };

    publish();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", publish);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", publish);
      if (isSearchHeader) {
        document.documentElement.style.removeProperty("--saa-header-h");
      }
    };
  }, [isSearchHeader]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!bellOpen) return undefined;
    const onDoc = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") setBellOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [bellOpen]);

  const openNotification = (item) => {
    setBellOpen(false);
    // Mark read in background — don't block navigation
    if (item?.id && (item.unread || !item.read_at)) {
      markNotificationRead(item.id)
        .then(() => {
          setUnreadCount((c) => Math.max(0, c - 1));
          setPreviewItems((list) =>
            list.map((n) =>
              n.id === item.id ? { ...n, read_at: new Date().toISOString(), unread: false } : n
            )
          );
        })
        .catch(() => {});
    }
    const link = item?.link || "/notifications/";
    if (link.startsWith("http")) {
      window.location.href = link;
    } else {
      window.location.href = link;
    }
  };

  const handleMarkAllRead = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (markingAll || unreadCount === 0) return;
    const prev = unreadCount;
    const prevItems = previewItems;
    setMarkingAll(true);
    setUnreadCount(0);
    setPreviewItems((list) =>
      list.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString(), unread: false }))
    );
    try {
      await markAllNotificationsRead();
    } catch {
      setUnreadCount(prev);
      setPreviewItems(prevItems);
    } finally {
      setMarkingAll(false);
    }
  };

  const solidBar = scrolled || isSearchHeader;
  const badgeLabel = unreadCount > 9 ? "9+" : String(unreadCount);

  const bellButton = (
    <div className="relative" ref={bellRef}>
      <button
        type="button"
        onClick={() => {
          setBellOpen((o) => !o);
          if (!bellOpen) refreshNotifications();
        }}
        className="relative inline-flex items-center justify-center p-2 rounded-md text-white hover:text-gray-200 hover:bg-white/10 transition-colors"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={bellOpen}
        aria-haspopup="true"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 ? (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold leading-none"
            style={unreadCount === 0 ? undefined : undefined}
          >
            {badgeLabel}
          </span>
        ) : null}
      </button>

      {bellOpen ? (
        <div
          className="absolute right-0 top-full mt-2 w-[min(100vw-1.5rem,22.5rem)] max-w-[360px] rounded-lg border border-gray-700 bg-black shadow-2xl z-[60] overflow-hidden"
          role="menu"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Notifications</span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="text-xs text-[#CFB36E] hover:text-white disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
            {previewItems.length === 0 ? (
              <p className="px-4 py-8 text-sm text-gray-400 text-center leading-relaxed">
                No new notifications. Save a search or a home to get alerts.
              </p>
            ) : (
              previewItems.map((item) => (
                <NotificationDropdownRow key={item.id} item={item} onOpen={openNotification} />
              ))
            )}
          </div>

          <div className="border-t border-gray-800">
            <Link
              to="/notifications/"
              onClick={() => setBellOpen(false)}
              className="block text-center text-sm font-medium py-2.5 text-[#CFB36E] hover:bg-white/10 transition-colors"
            >
              View all notifications
            </Link>
            <Link
              to="/notifications/#notification-settings"
              onClick={() => setBellOpen(false)}
              className="block text-center text-xs font-medium py-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-t border-gray-800/80"
            >
              Notification settings
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 pt-safe">
        <div
          className={`transition-all duration-300 ${
            solidBar ? "bg-black shadow-md" : "bg-transparent"
          }`}
        >
          <div
            className={`w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between relative ${
              isSearchHeader
                ? "py-2 min-h-[56px] sm:min-h-[60px] lg:min-h-[64px]"
                : "py-3 lg:py-6 min-h-[72px] sm:min-h-[96px] lg:min-h-[120px]"
            }`}
          >
            <div className="hidden lg:flex items-center gap-6 text-white z-30">
              <button
                onClick={() => setMenuOpen(true)}
                className="flex items-center gap-2 hover:text-gray-200 transition-colors text-sm"
              >
                <span className="text-xl">☰</span>
                <span>Menu</span>
              </button>
              <Link to="/properties/" className="hover:text-gray-200 transition-colors text-sm">
                Properties
              </Link>
              <Link to="/for-sellers/#home-valuation" className="hover:text-gray-200 transition-colors text-sm">
                Home Valuation
              </Link>
              <Link to="/northern-colorado-areas/" className="hover:text-gray-200 transition-colors text-sm">
                Northern Colorado Areas
              </Link>
            </div>

            <button
              aria-label="Toggle menu"
              className="lg:hidden inline-flex items-center justify-center p-2 rounded-md border border-white text-white hover:bg-white/10 transition-colors z-30 shrink-0"
              onClick={() => setMenuOpen(true)}
            >
              <span className="sr-only">Menu</span>
              <div className="flex flex-col gap-1.5">
                <span className="h-0.5 w-6 bg-white rounded"></span>
                <span className="h-0.5 w-6 bg-white rounded"></span>
                <span className="h-0.5 w-6 bg-white rounded"></span>
              </div>
            </button>

            <Link
              to="/"
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center z-40 pointer-events-auto"
            >
              <img
                src="/images/White-Logo-AUTOx110.fit.png"
                alt="Schwartz and Associates Logo"
                className={
                  isSearchHeader
                    ? "w-auto h-9 sm:h-10 lg:h-11"
                    : "w-auto h-14 sm:h-20 lg:h-[110px]"
                }
              />
            </Link>

            <nav className="hidden lg:flex items-center gap-6 text-white text-sm z-30">
              <Link to="/about-us/" className="hover:text-gray-200 transition-colors">About Us</Link>
              <div className="relative group">
                <Link to="/for-buyers/" className="hover:text-gray-200 transition-colors inline-flex items-center gap-1">
                  For Buyers
                  <span className="text-xs opacity-70" aria-hidden="true">▾</span>
                </Link>
                <div className="absolute left-0 top-full pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all">
                  <div className="min-w-[16rem] rounded-lg border border-gray-700 bg-black shadow-xl py-2">
                    <Link
                      to="/for-buyers/"
                      className="block px-4 py-2.5 text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      Buyer Overview
                    </Link>
                    <div className="my-1 border-t border-gray-800" />
                    <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                      Buyer Programs
                    </p>
                    {buyerProgramLinks.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        className="block px-4 py-2.5 text-sm text-gray-200 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <Link to="/for-sellers/" className="hover:text-gray-200 transition-colors">For Sellers</Link>
              <Link to="/luxury-real-estate/" className="hover:text-gray-200 transition-colors">Luxury</Link>
              <Link to="/blog/" className="hover:text-gray-200 transition-colors">Real Estate Guides</Link>
              <Link to="/contact/" className="hover:text-gray-200 transition-colors">Contact</Link>
              {hasAgentConsole ? (
                <Link
                  to="/agent/"
                  className="hover:text-gray-200 transition-colors font-semibold"
                  style={{ color: '#CFB36E' }}
                >
                  Agent console
                </Link>
              ) : null}
              {signedIn ? bellButton : null}
              {signedIn ? (
                <AccountMenu
                  email={sessionEmail}
                  unreadCount={unreadCount}
                  onSignOut={handleSignedOut}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(true)}
                  className="hover:text-gray-200 transition-colors text-sm text-white min-h-[44px]"
                >
                  Sign In / Sign Up
                </button>
              )}
            </nav>

            {/* Mobile: bell next to spacer / right edge when signed in */}
            <div className="lg:hidden flex items-center justify-end gap-1 z-30 shrink-0 min-w-[2.5rem]">
              {signedIn ? bellButton : <div className="w-10" aria-hidden="true" />}
            </div>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[100] transition-all duration-300 ${
          menuOpen ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
      >
        <div
          className="absolute inset-0 bg-black/90"
          onClick={() => setMenuOpen(false)}
        />

        <div
          className={`absolute left-0 top-0 h-full w-[min(100%,20rem)] bg-black text-white p-8 sm:p-12 pt-safe pb-safe overflow-y-auto transform transition-transform duration-300 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-6 right-6 text-white text-3xl hover:text-gray-300 transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>

          <nav className="mt-14 space-y-5">
            <Link onClick={closeMenu} to="/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Home</Link>

            <div>
              <div className="flex items-center justify-between gap-3">
                <Link onClick={closeMenu} to="/for-buyers/" className="text-lg sm:text-xl hover:text-gray-300 transition-colors font-semibold">
                  For Buyers
                </Link>
                <button
                  type="button"
                  onClick={() => setBuyersExpanded((open) => !open)}
                  className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1"
                  aria-expanded={buyersExpanded}
                  aria-label={buyersExpanded ? "Collapse buyer programs" : "Expand buyer programs"}
                >
                  {buyersExpanded ? "−" : "+"}
                </button>
              </div>
              {buyersExpanded && (
                <div className="mt-3 ml-3 pl-4 border-l border-gray-700 space-y-3">
                  <Link onClick={closeMenu} to="/for-buyers/" className="block text-sm text-gray-300 hover:text-white transition-colors">
                    Buyer Overview
                  </Link>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 pt-1">Buyer Programs</p>
                  {buyerProgramLinks.map((item) => (
                    <Link
                      key={item.to}
                      onClick={closeMenu}
                      to={item.to}
                      className="block text-sm sm:text-base text-gray-300 hover:text-white transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link onClick={closeMenu} to="/for-sellers/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">For Sellers</Link>
            <Link onClick={closeMenu} to="/luxury-real-estate/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Luxury Real Estate</Link>
            <Link onClick={closeMenu} to="/northern-colorado-areas/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Northern Colorado Areas</Link>
            <Link onClick={closeMenu} to="/testimonials/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Client Reviews</Link>
            <Link onClick={closeMenu} to="/blog/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Real Estate Guides</Link>
            <Link onClick={closeMenu} to="/properties/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Property Search</Link>
            <Link onClick={closeMenu} to="/about-us/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">About Us</Link>
            <Link onClick={closeMenu} to="/contact/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Contact</Link>
            {hasAgentConsole ? (
              <Link
                onClick={closeMenu}
                to="/agent/"
                className="block text-lg sm:text-xl font-semibold transition-colors"
                style={{ color: '#CFB36E' }}
              >
                Agent console
              </Link>
            ) : null}
            {signedIn ? (
              <AccountMenu
                email={sessionEmail}
                unreadCount={unreadCount}
                onSignOut={handleSignedOut}
                variant="mobile-inline"
                onNavigate={closeMenu}
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  closeMenu();
                  setAccountModalOpen(true);
                }}
                className="block text-lg sm:text-xl hover:text-gray-300 transition-colors mt-6 border-t border-gray-700 pt-6 text-left w-full"
              >
                Sign In / Sign Up
              </button>
            )}
          </nav>

          <div className="mt-10 space-y-3 text-sm text-gray-300">
            <a href="mailto:info@saahomes.com" className="block hover:text-white transition-colors">
              ✉ info@saahomes.com
            </a>
            <a href="tel:(970) 999-1407" className="block hover:text-white transition-colors">
              ☎ (970) 999-1407
            </a>
          </div>
        </div>
      </div>

      <AccountModal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        onSuccess={handleAccountSignedIn}
        purpose="sign-in"
        askIntent
        showSuccess
      />
    </>
  );
}
