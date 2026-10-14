import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useTenant } from "../context/TenantContext.jsx";

export default function FloatingContactBar() {
  const location = useLocation();
  const { tenant } = useTenant();
  const callHref = tenant?.brand?.tel || "tel:(970) 999-1407";
  // Another brokerage's domain: call only when it has a phone; help goes to its contact page.
  const isBrokerage = !!tenant?.isBrokerage;

  // Listing detail owns its own sticky CTAs; full-screen search needs the whole viewport
  if (
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/homes-for-sale/') ||
    location.pathname === '/properties' ||
    location.pathname === '/properties/'
  ) {
    return null;
  }

  const isAreaPage = location.pathname.startsWith('/northern-colorado-areas/');
  const isSellerPage = location.pathname.includes('for-sellers') || location.pathname.includes('home-valuation');
  const isSellerBlog = location.pathname.startsWith('/blog/') && /sell/.test(location.pathname);
  const isChfaPage = location.pathname.includes('chfa-schools-to-home') || location.pathname === '/chfa' || location.pathname === '/chfa/';
  const isChampionsPage = location.pathname.includes('colorado-champions-home-loan-program') || location.pathname.includes('champions-home-loan');
  const isChfaDpaPage = location.pathname.includes('chfa-down-payment-assistance') || location.pathname.includes('colorado-chfa-down-payment-assistance') || location.pathname.includes('chfa-dpa');
  const isGhopePage = location.pathname.includes('greeley-g-hope') || location.pathname.includes('g-hope-greeley');
  const helpLink = isSellerPage
    ? '#home-valuation'
    : isSellerBlog || isAreaPage
    ? '/for-sellers/#home-valuation'
    : isGhopePage
    ? '/greeley-g-hope-down-payment-assistance/#g-hope-lead-form'
    : isChfaPage
    ? '/chfa-schools-to-home/#chfa-lead-form'
    : isChampionsPage
      ? '/colorado-champions-home-loan-program/#champions-lead-form'
      : isChfaDpaPage
        ? '/chfa-down-payment-assistance/#chfa-dpa-lead-form'
        : '/contact/?interest=Buying a home';
  const helpLabel = isSellerPage || isAreaPage || isSellerBlog
    ? 'Get My Home Value'
    : isChfaPage || isChampionsPage || isChfaDpaPage || isGhopePage ? 'Free Consultation' : 'Get Help Buying';

  if (isBrokerage) {
    const b = tenant.brand || {};
    const tel = b.tel || (b.phone ? `tel:${b.phone}` : null);
    const isHome = location.pathname === '/' || location.pathname === '';
    return (
      <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex gap-3">
          {tel ? (
            <a
              href={tel}
              className="flex-1 inline-flex items-center justify-center px-3 py-3.5 bg-black text-white font-semibold rounded-lg text-sm touch-manipulation"
              aria-label={`Call ${b.brandName || 'us'}${b.phone ? ` at ${b.phone}` : ''}`}
            >
              Call Now
            </a>
          ) : null}
          {isHome ? (
            <a
              href="#home-value"
              className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
            >
              Get My Home Value
            </a>
          ) : (
            <Link
              to="/contact/?interest=Buying a home"
              className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
            >
              Get Help Buying
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex gap-3">
        <a
          href={callHref}
          className="flex-1 inline-flex items-center justify-center px-3 py-3.5 bg-black text-white font-semibold rounded-lg text-sm touch-manipulation"
          aria-label="Call Schwartz and Associates at (970) 999-1407"
        >
          Call Now
        </a>
        {isSellerPage || isAreaPage || isSellerBlog ? (
          <a
            href={helpLink}
            className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
            aria-label={helpLabel}
          >
            {helpLabel}
          </a>
        ) : (
          <Link
            to={helpLink}
            className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
            aria-label={helpLabel}
          >
            {helpLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
