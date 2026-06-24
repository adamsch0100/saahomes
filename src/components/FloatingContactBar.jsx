import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function FloatingContactBar() {
  const location = useLocation();

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3">
      <div className="flex gap-3">
        <a
          href="tel:(970) 999-1407"
          className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-black text-white font-semibold rounded-lg text-sm"
        >
          Call Now
        </a>
        <Link
          to="/contact/"
          className="flex-1 inline-flex items-center justify-center px-4 py-3 border-2 border-black text-black font-semibold rounded-lg text-sm"
        >
          Get Help Buying
        </Link>
      </div>
    </div>
  );
}
