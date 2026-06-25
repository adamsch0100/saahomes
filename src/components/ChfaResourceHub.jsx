import React from "react";
import { Link } from "react-router-dom";

const hubLinks = [
  {
    title: "CHFA Down Payment Assistance",
    href: "/chfa-down-payment-assistance/",
    description: "Grants & loans up to $25K for first-time buyers",
    badge: "Most popular",
  },
  {
    title: "G-HOPE Greeley",
    href: "/greeley-g-hope-down-payment-assistance/",
    description: "Up to $8K for Greeley-area employees",
    badge: "Greeley workforce",
  },
  {
    title: "CHFA Schools To Home",
    href: "/chfa-schools-to-home/",
    description: "Up to 25% DPA for Colorado educators",
    badge: "July 2026",
  },
  {
    title: "Champions Home Loan",
    href: "/colorado-champions-home-loan-program/",
    description: "Expanded eligibility for first responders",
    badge: "Late 2026",
  },
];

const blogGuides = [
  {
    title: "Complete CHFA Down Payment Guide (2026)",
    href: "/blog/chfa-down-payment-assistance-colorado-2026/",
  },
  {
    title: "CHFA for Fort Collins & Greeley Buyers",
    href: "/blog/chfa-first-time-homebuyer-northern-colorado/",
  },
  {
    title: "CHFA Schools To Home for Educators",
    href: "/blog/chfa-schools-to-home-colorado-teachers/",
  },
  {
    title: "Champions Program for First Responders",
    href: "/blog/colorado-champions-home-loan-first-responders/",
  },
];

export default function ChfaResourceHub({ compact = false }) {
  if (compact) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-6">
        <h3 className="font-bold font-serif text-lg mb-4">Explore buyer programs</h3>
        <div className="space-y-3">
          {hubLinks.map((link) => (
            <Link key={link.href} to={link.href} className="block group">
              <span className="font-semibold text-gray-900 group-hover:underline">{link.title}</span>
              <span className="block text-sm text-gray-600">{link.description}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-16 px-6 bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: "#CFB36E" }}>
            Colorado Homebuyer Resources
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold font-serif mb-4">Your homebuyer program hub</h2>
          <p className="text-gray-300 max-w-2xl mx-auto">
            SAA Homes publishes in-depth guides on CHFA, G-HOPE, and other Northern Colorado down payment programs. Start with the overview that fits your situation.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {hubLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="group block rounded-xl p-6 border border-gray-700 bg-gray-800/50 hover:border-[#CFB36E] hover:bg-gray-800 transition-all"
            >
              <span
                className="inline-block px-2 py-0.5 rounded text-xs font-bold uppercase mb-3"
                style={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
              >
                {link.badge}
              </span>
              <h3 className="text-xl font-bold font-serif mb-2 group-hover:underline">{link.title}</h3>
              <p className="text-gray-400 text-sm">{link.description}</p>
              <span className="inline-block mt-4 text-sm font-semibold" style={{ color: "#CFB36E" }}>
                View program →
              </span>
            </Link>
          ))}
        </div>

        <div className="border-t border-gray-700 pt-8">
          <h3 className="font-bold font-serif text-lg mb-4 text-center">CHFA guides from our blog</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {blogGuides.map((guide) => (
              <Link
                key={guide.href}
                to={guide.href}
                className="text-sm text-gray-300 hover:text-white hover:underline py-2"
              >
                {guide.title} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
