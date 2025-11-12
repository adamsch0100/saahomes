import React from "react";

export default function Footer() {
  return (
    <footer className="w-full bg-black text-white">
      <div className="w-full px-6 md:px-12 py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Logo Column */}
          <div>
            <div className="flex items-start gap-4">
              <img 
                src="https://assets.thesparksite.com/uploads/sites/4167/2024/04/new-footermax.max.png" 
                alt="Schwartz and Associates Logo"
                className="h-24 w-auto"
              />
              <img 
                src="https://assets.thesparksite.com/uploads/sites/4167/2022/11/logo-cb-stacked.max.png" 
                alt="Coldwell Banker Realty"
                className="h-24 w-auto"
              />
            </div>
            <p className="mt-4 text-sm text-gray-300">
              This isn't just a job, it's what we love to do. We wake up in the morning focused on your real estate goals, eager to help our clients succeed.
            </p>
            
            {/* Social Icons */}
            <div className="mt-4 flex gap-3">
              <a href="https://www.facebook.com/schwartzandassociateshomes" className="w-10 h-10 border border-white flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z"/></svg>
              </a>
              <a href="https://youtube.com/@SAAHomes" className="w-10 h-10 border border-white flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
              </a>
              <a href="https://www.instagram.com/saa_homes/" className="w-10 h-10 border border-white flex items-center justify-center hover:bg-white/10 transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
            </div>
          </div>

          {/* About Column */}
          <div>
            <h4 className="font-semibold text-white mb-3">ABOUT</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/" className="hover:text-gray-300 transition-colors">Home</a></li>
              <li><a href="/about-us/" className="hover:text-gray-300 transition-colors">About Us</a></li>
              <li><a href="/testimonials/" className="hover:text-gray-300 transition-colors">Testimonials</a></li>
              <li><a href="/blog/" className="hover:text-gray-300 transition-colors">Blog</a></li>
              <li><a href="/contact/" className="hover:text-gray-300 transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Let's Work Column */}
          <div>
            <h4 className="font-semibold text-white mb-3">LET'S WORK</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/for-buyers/" className="hover:text-gray-300 transition-colors">Buyers</a></li>
              <li><a href="/for-sellers/" className="hover:text-gray-300 transition-colors">Sellers</a></li>
              <li><a href="/featured-areas/" className="hover:text-gray-300 transition-colors">Featured Areas</a></li>
              <li><a href="/helpful-guides/" className="hover:text-gray-300 transition-colors">Helpful Guides</a></li>
            </ul>
          </div>

          {/* Services Column */}
          <div>
            <h4 className="font-semibold text-white mb-3">SERVICES</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/perfect-home-finder/" className="hover:text-gray-300 transition-colors">Perfect Home Finder</a></li>
              <li><a href="/home-valuation/" className="hover:text-gray-300 transition-colors">What's My Home Worth?</a></li>
              <li><a href="/mortgage-calculator/" className="hover:text-gray-300 transition-colors">Mortgage Calculator</a></li>
            </ul>
          </div>
        </div>

        {/* Address and Copyright */}
        <div className="mt-10 pt-6 border-t border-gray-800 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-gray-300">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
              3665 John F Kenne
            </p>
            <p className="mt-2 text-gray-300">info@saahomes.com</p>
            <p className="mt-1 text-gray-300">(970) 999-1407</p>
          </div>
          <div className="text-gray-300">
            <a href="/privacy-policy/" className="hover:text-white transition-colors">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}