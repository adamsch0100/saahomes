import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getTenant, isCustomDomain } from '../utils/tenant.js';
import { applyBrandTheme, themeFromBrand } from '../utils/brandTheme.js';
import { setListingPhotoFallbackBrand } from '../utils/photoUrl.js';

const TenantContext = createContext({ tenant: null, loading: false });

/**
 * Another brokerage's brand takes over the page: colors (CSS variables on
 * <html>), theme-color, the listing-photo placeholder, and a body class that
 * keeps SAA's prerendered link band out of view. SAA's own hosts never get here.
 */
function applyBrokerageBrand(tenant) {
  const theme = themeFromBrand(tenant.brand);
  applyBrandTheme(theme);
  setListingPhotoFallbackBrand({ accent: theme.accent, label: tenant.brand?.brandName || '' });
  if (typeof document === 'undefined') return;
  document.body.classList.add('brokerage-site');
  // Home-screen name and icon (the manifest itself is served per brokerage).
  const name = tenant.brand?.brandName || tenant.name || '';
  const title = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (title) title.setAttribute('content', name);
  const icon = tenant.brand?.iconUrl;
  if (icon) {
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach((el) => {
      el.setAttribute('href', icon);
      el.removeAttribute('type');
    });
  }
}

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);
  // On a non-SAA host the brand isn't known until /api/tenant answers.
  const [loading, setLoading] = useState(() => isCustomDomain());

  useEffect(() => {
    let cancelled = false;
    getTenant()
      .then((resolved) => {
        if (cancelled) return;
        if (resolved?.isBrokerage) applyBrokerageBrand(resolved);
        setTenant(resolved || null);
      })
      .catch(() => {
        if (!cancelled) setTenant(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ tenant, loading }), [tenant, loading]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext) || { tenant: null, loading: false };
}

/** True on another brokerage's own domain (not SAA's site or an SAA agent's domain). */
export function useIsBrokerage() {
  const { tenant } = useTenant();
  return !!tenant?.isBrokerage;
}

/**
 * The brokerage's brand on its own domain, or null on SAA's site (where callers
 * keep SAA's copy as is). Missing values are null: leave that line out.
 */
export function useBrokerageBrand() {
  const { tenant } = useTenant();
  return useMemo(() => {
    if (!tenant?.isBrokerage) return null;
    const b = tenant.brand || {};
    return {
      name: b.brandName || tenant.name || '',
      legalName: b.brokerage || null,
      phone: b.phone || null,
      tel: b.tel || (b.phone ? `tel:${b.phone}` : null),
      email: b.email || null,
      market: tenant.marketName || b.marketName || null,
      agentName: tenant.agentName || b.agentName || null,
      logoUrl: b.logoUrl || null,
      brandLine: b.brandLine || null,
      licenseLine: b.licenseLine || null,
      tagline: b.tagline || null,
      address: b.address || null,
    };
  }, [tenant]);
}

/**
 * Prefix document.title on properties/search routes when a tenant is present.
 * Helmet <title> only — does not touch og/canonical/meta (SEO stays SAA).
 */
export function TenantDocumentTitle() {
  const { tenant } = useTenant();
  const location = useLocation();
  const brandName = tenant?.brand?.brandName;
  if (!brandName) return null;

  const path = location.pathname;
  const isProperties = path === '/properties' || path === '/properties/';
  if (!isProperties) return null;

  const loc = new URLSearchParams(location.search).get('location');
  const market = tenant?.isBrokerage ? tenant.marketName || tenant.brand?.marketName : 'Northern Colorado';
  const rest = loc
    ? `Homes for Sale in ${loc}`
    : market ? `Homes for Sale in ${market}` : 'Homes for Sale';

  return (
    <Helmet>
      <title>{`${brandName} — ${rest}`}</title>
    </Helmet>
  );
}

export default TenantProvider;
