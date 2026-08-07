import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function FloatingContactBar() {
  const location = useLocation();

  // Listing detail owns its own sticky CTAs; full-screen search needs the whole viewport
  if (
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/homes-for-sale/') ||
    location.pathname === '/properties' ||
    location.pathname === '/properties/'
  ) {
    return null;
  }

  const isChfaPage = location.pathname.includes('chfa-schools-to-home') || location.pathname === '/chfa' || location.pathname === '/chfa/';
  const isChampionsPage = location.pathname.includes('colorado-champions-home-loan-program') || location.pathname.includes('champions-home-loan');
  const isChfaDpaPage = location.pathname.includes('chfa-down-payment-assistance') || location.pathname.includes('colorado-chfa-down-payment-assistance') || location.pathname.includes('chfa-dpa');
  const isGhopePage = location.pathname.includes('greeley-g-hope') || location.pathname.includes('g-hope-greeley');
  const isSellerPage = location.pathname.includes('for-sellers') || location.pathname.includes('home-valuation');
  const helpLink = isSellerPage
    ? '#home-valuation'
    : isGhopePage
    ? '/greeley-g-hope-down-payment-assistance/#g-hope-lead-form'
    : isChfaPage
    ? '/chfa-schools-to-home/#chfa-lead-form'
    : isChampionsPage
      ? '/colorado-champions-home-loan-program/#champions-lead-form'
      : isChfaDpaPage
        ? '/chfa-down-payment-assistance/#chfa-dpa-lead-form'
        : '/contact/?interest=Buying a home';
  const helpLabel = isSellerPage
    ? 'Get My Home Value'
    : isChfaPage || isChampionsPage || isChfaDpaPage || isGhopePage ? 'Free Consultation' : 'Get Help Buying';

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex gap-3">
        <a
          href="tel:(970) 999-1407"
          className="flex-1 inline-flex items-center justify-center px-3 py-3.5 bg-black text-white font-semibold rounded-lg text-sm touch-manipulation"
        >
          Call Now
        </a>
        {isSellerPage ? (
          <a
            href={helpLink}
            className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
          >
            {helpLabel}
          </a>
        ) : (
          <Link
            to={helpLink}
            className="flex-1 inline-flex items-center justify-center px-3 py-3.5 border-2 border-black text-black font-semibold rounded-lg text-sm text-center leading-tight touch-manipulation"
          >
            {helpLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
