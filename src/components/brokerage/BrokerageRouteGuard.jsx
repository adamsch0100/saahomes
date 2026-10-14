/**
 * Routing for another brokerage's own domain.
 *
 * - TenantLoadingGate: on a non-SAA host, show a neutral shell until /api/tenant
 *   answers, so SAA's page never flashes on a brokerage's domain.
 * - BrokerageRouteGuard: on a brokerage's domain, `/` and `/contact` render the
 *   brokerage's own pages, the shared tools (search, listings, saved searches,
 *   my home, notifications, mortgage calculator, consoles) render as usual, and
 *   every SAA-only page (blog, area guides, CHFA and loan programs, about,
 *   testimonials, events, resources, …) renders not-found.
 *
 * On saahomes.com (no brokerage) both are pass-throughs.
 */
import React, { lazy } from "react";
import { useLocation } from "react-router-dom";
import { useTenant, useIsBrokerage } from "../../context/TenantContext.jsx";

const BrokerageHomePage = lazy(() =>
  import("../../pages/BrokeragePages.jsx").then((m) => ({ default: m.BrokerageHomePage }))
);
const BrokerageContactPage = lazy(() =>
  import("../../pages/BrokeragePages.jsx").then((m) => ({ default: m.BrokerageContactPage }))
);
const BrokerageNotFoundPage = lazy(() =>
  import("../../pages/BrokeragePages.jsx").then((m) => ({ default: m.BrokerageNotFoundPage }))
);

// Paths a brokerage's site shares with SAA's (trailing slash optional).
const SHARED_PATHS = [
  /^\/properties$/,
  /^\/homes-for-sale\/[^/]+$/,
  /^\/alerts\/manage$/,
  /^\/my-saved-searches$/,
  /^\/my-home$/,
  /^\/notifications$/,
  /^\/board$/,
  /^\/mortgage-calculator$/,
  /^\/admin$/,
  /^\/agent$/,
  /^\/reset-password$/,
  /^\/embed\/(search|listings|listing)$/,
  /^\/embed\/listing\/[^/]+$/,
];

function normalize(pathname) {
  const p = String(pathname || "/");
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

export function isBrokerageSharedPath(pathname) {
  const p = normalize(pathname);
  return SHARED_PATHS.some((re) => re.test(p));
}

/** Neutral page while the brand loads: no SAA name, logo or gold. */
export function TenantLoadingShell() {
  return (
    <div className="min-h-screen w-full bg-white" role="status" aria-live="polite" aria-label="Loading">
      <div className="h-[72px] sm:h-[96px] w-full bg-gray-100 animate-pulse" />
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6 animate-pulse">
        <div className="h-10 w-2/3 max-w-lg rounded bg-gray-100" />
        <div className="h-4 w-1/2 max-w-md rounded bg-gray-100" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function TenantLoadingGate({ children }) {
  const { loading } = useTenant();
  return loading ? <TenantLoadingShell /> : children;
}

export default function BrokerageRouteGuard({ children }) {
  const isBrokerage = useIsBrokerage();
  const { pathname } = useLocation();
  if (!isBrokerage) return children;

  const p = normalize(pathname);
  if (p === "/") return <BrokerageHomePage />;
  if (p === "/contact") return <BrokerageContactPage />;
  if (isBrokerageSharedPath(p)) return children;
  return <BrokerageNotFoundPage />;
}
