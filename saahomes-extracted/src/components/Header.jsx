import React, { useState } from "react";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top Bar */}
      <div className="bg-[#d4c5a0] text-gray-800 py-2 px-4 text-sm text-right">
        <span className="cursor-pointer hover:underline">Sign In / Sign Up</span>
      </div>

      {/* Main Header */}
      <div className="bg-black">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          {/* Left: Menu Buttons */}
          <div className="hidden lg:flex items-center gap-6 text-white">
            <button className="flex items-center gap-2 hover:text-gray-200 transition-colors text-sm">
              <span>☰</span>
              <span>Menu</span>
            </button>
            <button className="hover:text-gray-200 transition-colors text-sm">
              Properties
            </button>
            <button className="hover:text-gray-200 transition-colors text-sm">
              Home Valuation
            </button>
            <button className="hover:text-gray-200 transition-colors text-sm">
              Featured Areas
            </button>
          </div>

          {/* Center: Logo */}
          <a href="/" className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
            <img 
              src="https://assets.thesparksite.com/uploads/sites/4167/2022/11/White-Logo-AUTOx110.fit.png" 
              alt="Schwartz and Associates Logo"
              className="h-16 w-auto"
            />
          </a>

          {/* Right: Nav Links */}
          <nav className="hidden lg:flex items-center gap-6 text-white text-sm">
            <a href="/about-us/" className="hover:text-gray-200 transition-colors">About Us</a>
            <a href="/for-buyers/" className="hover:text-gray-200 transition-colors">For Buyers</a>
            <a href="/for-sellers/" className="hover:text-gray-200 transition-colors">For Sellers</a>
            <a href="/contact/" className="hover:text-gray-200 transition-colors">Contact</a>
          </nav>

          {/* Mobile Menu Toggle */}
          <button
            aria-label="Toggle menu"
            className="lg:hidden inline-flex items-center justify-center p-2 rounded-md border border-white text-white hover:bg-white/10 transition-colors"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sr-only">Menu</span>
            <div className="flex flex-col gap-1.5">
              <span className="h-0.5 w-6 bg-white rounded"></span>
              <span className="h-0.5 w-6 bg-white rounded"></span>
              <span className="h-0.5 w-6 bg-white rounded"></span>
            </div>
          </button>
        </div>

        {open && (
          <div className="lg:hidden px-4 pb-4 space-y-2 bg-white border-t">
            <a onClick={() => setOpen(false)} href="/" className="block px-3 py-2 rounded hover:bg-gray-100">Home</a>
            <a onClick={() => setOpen(false)} href="/for-buyers/" className="block px-3 py-2 rounded hover:bg-gray-100">For Buyers</a>
            <a onClick={() => setOpen(false)} href="/for-sellers/" className="block px-3 py-2 rounded hover:bg-gray-100">For Sellers</a>
            <a onClick={() => setOpen(false)} href="/our-areas/" className="block px-3 py-2 rounded hover:bg-gray-100">Featured Areas</a>
            <a onClick={() => setOpen(false)} href="/properties/" className="block px-3 py-2 rounded hover:bg-gray-100">Property Search</a>
            <a onClick={() => setOpen(false)} href="/about-us/" className="block px-3 py-2 rounded hover:bg-gray-100">About Us</a>
            <a onClick={() => setOpen(false)} href="/contact/" className="block px-3 py-2 rounded hover:bg-gray-100">Contact</a>
            <div className="border-t pt-2 mt-2">
              <a onClick={() => setOpen(false)} href="mailto:info@saahomes.com" className="block px-3 py-2 text-sm text-gray-600">info@saahomes.com</a>
              <a onClick={() => setOpen(false)} href="tel:(970) 999-1407" className="block px-3 py-2 text-sm text-gray-600">(970) 999-1407</a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}