import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const buyerProgramLinks = [
  { label: "CHFA Down Payment Assistance", to: "/chfa-down-payment-assistance/" },
  { label: "G-HOPE Greeley (City Employees)", to: "/greeley-g-hope-down-payment-assistance/" },
  { label: "CHFA Schools To Home", to: "/chfa-schools-to-home/" },
  { label: "Champions Home Loan", to: "/colorado-champions-home-loan-program/" },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [buyersExpanded, setBuyersExpanded] = useState(false);

  const closeMenu = () => {
    setMenuOpen(false);
    setBuyersExpanded(false);
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
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 pt-safe">
        <div
          className={`transition-all duration-300 ${
            scrolled ? "bg-black shadow-md" : "bg-transparent"
          }`}
        >
          <div className="w-full px-4 sm:px-6 lg:px-8 py-3 lg:py-6 flex items-center justify-between relative min-h-[72px] sm:min-h-[96px] lg:min-h-[120px]">
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
                className="w-auto h-14 sm:h-20 lg:h-[110px]"
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
              <Link to="/blog/" className="hover:text-gray-200 transition-colors">Real Estate Guides</Link>
              <Link to="/contact/" className="hover:text-gray-200 transition-colors">Contact</Link>
              <Link to="/properties/" className="hover:text-gray-200 transition-colors">Sign In / Sign Up</Link>
            </nav>

            <div className="lg:hidden w-10 shrink-0" aria-hidden="true" />
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
            <Link onClick={closeMenu} to="/northern-colorado-areas/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Northern Colorado Areas</Link>
            <Link onClick={closeMenu} to="/testimonials/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Client Reviews</Link>
            <Link onClick={closeMenu} to="/blog/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Real Estate Guides</Link>
            <Link onClick={closeMenu} to="/properties/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Property Search</Link>
            <Link onClick={closeMenu} to="/about-us/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">About Us</Link>
            <Link onClick={closeMenu} to="/contact/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors">Contact</Link>
            <Link onClick={closeMenu} to="/properties/" className="block text-lg sm:text-xl hover:text-gray-300 transition-colors mt-6 border-t border-gray-700 pt-6">
              Sign In / Sign Up
            </Link>
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
    </>
  );
}
