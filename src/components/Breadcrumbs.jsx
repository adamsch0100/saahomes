import React from "react";
import { Link, useLocation } from "react-router-dom";

const breadcrumbMap = {
  "about-us": "About Us",
  "for-buyers": "Colorado Home Buyers",
  "for-sellers": "Sell Your Colorado Home",
  contact: "Contact",
  "featured-areas": "Northern Colorado Communities",
  "northern-colorado-areas": "Northern Colorado Areas",
  "fort-collins": "Fort Collins",
  loveland: "Loveland",
  windsor: "Windsor",
  greeley: "Greeley",
  timnath: "Timnath",
  wellington: "Wellington",
  johnstown: "Johnstown",
  eaton: "Eaton",
  milliken: "Milliken",
  "la-salle": "La Salle",
  mead: "Mead",
  longmont: "Longmont",
  boulder: "Boulder",
  "mortgage-calculator": "Colorado Mortgage Calculator",
  testimonials: "Client Testimonials",
  blog: "Colorado Real Estate Guides",
  "helpful-guides": "Colorado Real Estate Guides",
  "chfa-schools-to-home": "CHFA Schools To Home Program",
  chfa: "CHFA Schools To Home Program",
  properties: "Homes for Sale in Colorado",
};

const customTrails = {
  "/chfa-schools-to-home": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/chfa-schools-to-home/", label: "CHFA Schools To Home Program" },
  ],
  "/chfa": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/chfa-schools-to-home/", label: "CHFA Schools To Home Program" },
  ],
  "/for-buyers": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
  ],
  "/mortgage-calculator": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/mortgage-calculator/", label: "Colorado Mortgage Calculator" },
  ],
};

const visibleBreadcrumbRoutes = new Set([
  "/chfa-schools-to-home",
  "/chfa",
  "/for-buyers",
  "/mortgage-calculator",
]);

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function getTrail(pathname) {
  const normalized = normalizePath(pathname);
  if (customTrails[normalized]) {
    return customTrails[normalized];
  }

  const pathnames = normalized.split("/").filter(Boolean);
  if (pathnames.length === 0) return null;

  return [
    { path: "/", label: "Home" },
    ...pathnames.map((segment, index) => {
      const path = `/${pathnames.slice(0, index + 1).join("/")}/`;
      return {
        path,
        label: breadcrumbMap[segment] || segment
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" "),
      };
    }),
  ];
}

export default function Breadcrumbs() {
  const location = useLocation();
  const trail = getTrail(location.pathname);

  if (!trail) return null;

  const normalized = normalizePath(location.pathname);
  const isVisible = visibleBreadcrumbRoutes.has(normalized);

  return (
    <nav
      aria-label="Breadcrumb"
      className={
        isVisible
          ? "w-full bg-gray-50 border-b border-gray-200 pt-28"
          : "sr-only"
      }
    >
      <ol
        className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 max-w-7xl mx-auto px-6 py-3"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {trail.map((crumb, index) => {
          const isLast = index === trail.length - 1;

          return (
            <li
              key={`${crumb.path}-${crumb.label}`}
              className="flex items-center"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && <span className="mx-2 text-gray-400" aria-hidden="true">/</span>}
              {isLast ? (
                <span itemProp="name" className="text-gray-900 font-medium" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.path} itemProp="item" className="hover:text-black transition-colors">
                  <span itemProp="name">{crumb.label}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
