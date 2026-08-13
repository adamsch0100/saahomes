import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { getTenant } from '../utils/tenant.js';

const TenantContext = createContext({ tenant: null });

export function TenantProvider({ children }) {
  const [tenant, setTenant] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTenant()
      .then((resolved) => {
        if (!cancelled) setTenant(resolved || null);
      })
      .catch(() => {
        if (!cancelled) setTenant(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ tenant }), [tenant]);
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext) || { tenant: null };
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
  const rest = loc
    ? `Homes for Sale in ${loc}`
    : 'Homes for Sale in Northern Colorado';

  return (
    <Helmet>
      <title>{`${brandName} — ${rest}`}</title>
    </Helmet>
  );
}

export default TenantProvider;
