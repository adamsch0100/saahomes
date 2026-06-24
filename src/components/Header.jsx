import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  const isHomePage = location.pathname === "/" || location.pathname === "";
  const useDarkHeader = !isHomePage && !scrolled;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  const headerBg = scrolled
    ? "bg-black shadow-md"
    : useDarkHeader
      ? "bg-white border-b border-gray-200 shadow-sm"
      : "bg-transparent";

  const navText = useDarkHeader ? "text-gray-900" : "text-white";
  const navHover = useDarkHeader ? "hover:text-gray-600" : "hover:text-gray-200";
  const mobileBorder = useDarkHeader ? "border-gray-900" : "border-white";
  const mobileHover = useDarkHeader ? "hover:bg-gray-100" : "hover:bg-white/10";
  const barColor = useDarkHeader ? "bg-gray-900" : "bg-white";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50">
        <div className={`transition-all duration-300 ${headerBg}`}>
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between relative min-h-[120px]">
            <div className={`hidden lg:flex items-center gap-6 ${navText} z-30`}>
              <button
                onClick={() => setMenuOpen(true)}
                className={`flex items-center gap-2 ${navHover} transition-colors text-sm`}
              >
                <span className="text-xl">☰</span>
                <span>Menu</span>
              </button>
              <Link to="/properties/" className={`${navHover} transition-colors text-sm`}>
                Properties
              </Link>
              <Link to="/for-sellers/#home-valuation" className={`${navHover} transition-colors text-sm`}>
                Home Valuation
              </Link>
              <Link to="/northern-colorado-areas/" className={`${navHover} transition-colors text-sm`}>
                Northern Colorado Areas
              </Link>
            </div>

            <Link to="/" className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center z-40">
              <img
                src="/images/White-Logo-AUTOx110.fit.png"
                alt="Schwartz and Associates Logo"
                className={`w-auto transition-all duration-300 ${useDarkHeader ? "brightness-0" : ""}`}
                style={{ height: "110px" }}
              />
            </Link>

            <nav className={`hidden lg:flex items-center gap-6 ${navText} text-sm z-30`}>
              <Link to="/about-us/" className={`${navHover} transition-colors`}>About Us</Link>
              <Link to="/for-buyers/" className={`${navHover} transition-colors`}>For Buyers</Link>
              <Link to="/for-sellers/" className={`${navHover} transition-colors`}>For Sellers</Link>
              <Link to="/contact/" className={`${navHover} transition-colors`}>Contact</Link>
              <Link to="/properties/" className={`${navHover} transition-colors`}>Sign In / Sign Up</Link>
            </nav>

            <button
              aria-label="Toggle menu"
              className={`lg:hidden inline-flex items-center justify-center p-2 rounded-md border ${mobileBorder} ${navText} ${mobileHover} transition-colors z-30`}
              onClick={() => setMenuOpen(true)}
            >
              <span className="sr-only">Menu</span>
              <div className="flex flex-col gap-1.5">
                <span className={`h-0.5 w-6 ${barColor} rounded`}></span>
                <span className={`h-0.5 w-6 ${barColor} rounded`}></span>
                <span className={`h-0.5 w-6 ${barColor} rounded`}></span>
              </div>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[100] transition-all duration-300 ${
          menuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div
          className="absolute inset-0 bg-black"
          onClick={() => setMenuOpen(false)}
        />

        <div className={`absolute left-0 top-0 h-full w-80 bg-black text-white p-12 transform transition-transform duration-300 ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          <button
            onClick={() => setMenuOpen(false)}
            className="absolute top-8 right-8 text-white text-3xl hover:text-gray-300 transition-colors"
            aria-label="Close menu"
          >
            ✕
          </button>

          <nav className="mt-16 space-y-6">
            <Link onClick={() => setMenuOpen(false)} to="/" className="block text-xl hover:text-gray-300 transition-colors">Home</Link>
            <Link onClick={() => setMenuOpen(false)} to="/for-buyers/" className="block text-xl hover:text-gray-300 transition-colors">For Buyers</Link>
            <Link onClick={() => setMenuOpen(false)} to="/for-sellers/" className="block text-xl hover:text-gray-300 transition-colors">For Sellers</Link>
            <Link onClick={() => setMenuOpen(false)} to="/northern-colorado-areas/" className="block text-xl hover:text-gray-300 transition-colors">Northern Colorado Areas</Link>
            <Link onClick={() => setMenuOpen(false)} to="/chfa-schools-to-home/" className="block text-xl hover:text-gray-300 transition-colors">CHFA Schools To Home</Link>
            <Link onClick={() => setMenuOpen(false)} to="/testimonials/" className="block text-xl hover:text-gray-300 transition-colors">Client Reviews</Link>
            <Link onClick={() => setMenuOpen(false)} to="/blog/" className="block text-xl hover:text-gray-300 transition-colors">Real Estate Guides</Link>
            <Link onClick={() => setMenuOpen(false)} to="/properties/" className="block text-xl hover:text-gray-300 transition-colors">Property Search</Link>
            <Link onClick={() => setMenuOpen(false)} to="/about-us/" className="block text-xl hover:text-gray-300 transition-colors">About Us</Link>
            <Link onClick={() => setMenuOpen(false)} to="/contact/" className="block text-xl hover:text-gray-300 transition-colors">Contact</Link>
            <Link onClick={() => setMenuOpen(false)} to="/properties/" className="block text-xl hover:text-gray-300 transition-colors mt-8 border-t border-gray-700 pt-6">
              Sign In / Sign Up
            </Link>
          </nav>

          <div className="absolute bottom-12 left-12 space-y-3 text-sm text-gray-300">
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
