import React from "react";
import { Link, useLocation } from "react-router-dom";
import { getBlogPost } from "../data/blogPosts";

const breadcrumbMap = {
  "about-us": "About SAA Homes",
  "for-buyers": "Colorado Home Buyers",
  "for-sellers": "Sell Your Northern Colorado Home",
  contact: "Contact Northern Colorado Realtors",
  "featured-areas": "Northern Colorado Communities",
  "northern-colorado-areas": "Northern Colorado Communities",
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
    berthoud: "Berthoud",
    firestone: "Firestone",
    frederick: "Frederick",
    evans: "Evans",
    severance: "Severance",
    niwot: "Niwot",
    "mortgage-calculator": "Colorado Mortgage Calculator",
  testimonials: "Client Reviews",
  blog: "Colorado Real Estate Guides",
  "helpful-guides": "Colorado Real Estate Guides",
  "chfa-schools-to-home": "CHFA Schools To Home Program",
  chfa: "CHFA Schools To Home Program",
  "colorado-champions-home-loan-program": "Colorado Champions Home Loan Program",
  "champions-home-loan": "Colorado Champions Home Loan Program",
  "chfa-down-payment-assistance": "CHFA Down Payment Assistance",
  "colorado-chfa-down-payment-assistance": "CHFA Down Payment Assistance",
  "chfa-dpa": "CHFA Down Payment Assistance",
  "greeley-g-hope-down-payment-assistance": "G-HOPE Greeley Down Payment Assistance",
  "g-hope-greeley": "G-HOPE Greeley Down Payment Assistance",
  properties: "Homes for Sale in Colorado",
  buyers: "Colorado Home Buyers",
  sellers: "Sell Your Northern Colorado Home",
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
  "/colorado-champions-home-loan-program": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/colorado-champions-home-loan-program/", label: "Colorado Champions Home Loan Program" },
  ],
  "/champions-home-loan": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/colorado-champions-home-loan-program/", label: "Colorado Champions Home Loan Program" },
  ],
  "/chfa-down-payment-assistance": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
  ],
  "/colorado-chfa-down-payment-assistance": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
  ],
  "/chfa-dpa": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/chfa-down-payment-assistance/", label: "CHFA Down Payment Assistance" },
  ],
  "/greeley-g-hope-down-payment-assistance": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/northern-colorado-areas/greeley/", label: "Greeley, CO" },
    { path: "/greeley-g-hope-down-payment-assistance/", label: "G-HOPE Down Payment Assistance" },
  ],
  "/g-hope-greeley": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/northern-colorado-areas/greeley/", label: "Greeley, CO" },
    { path: "/greeley-g-hope-down-payment-assistance/", label: "G-HOPE Down Payment Assistance" },
  ],
  "/for-buyers": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
  ],
  "/buyers": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
  ],
  "/for-sellers": [
    { path: "/", label: "Home" },
    { path: "/for-sellers/", label: "Sell Your Northern Colorado Home" },
  ],
  "/sellers": [
    { path: "/", label: "Home" },
    { path: "/for-sellers/", label: "Sell Your Northern Colorado Home" },
  ],
  "/mortgage-calculator": [
    { path: "/", label: "Home" },
    { path: "/for-buyers/", label: "Colorado Home Buyers" },
    { path: "/mortgage-calculator/", label: "Colorado Mortgage Calculator" },
  ],
  "/northern-colorado-areas": [
    { path: "/", label: "Home" },
    { path: "/northern-colorado-areas/", label: "Northern Colorado Communities" },
  ],
  "/featured-areas": [
    { path: "/", label: "Home" },
    { path: "/northern-colorado-areas/", label: "Northern Colorado Communities" },
  ],
  "/properties": [
    { path: "/", label: "Home" },
    { path: "/properties/", label: "Homes for Sale in Colorado" },
  ],
  "/testimonials": [
    { path: "/", label: "Home" },
    { path: "/testimonials/", label: "Client Reviews" },
  ],
  "/blog": [
    { path: "/", label: "Home" },
    { path: "/blog/", label: "Colorado Real Estate Guides" },
  ],
  "/helpful-guides": [
    { path: "/", label: "Home" },
    { path: "/blog/", label: "Colorado Real Estate Guides" },
  ],
  "/about-us": [
    { path: "/", label: "Home" },
    { path: "/about-us/", label: "About SAA Homes" },
  ],
  "/contact": [
    { path: "/", label: "Home" },
    { path: "/contact/", label: "Contact Northern Colorado Realtors" },
  ],
};

function normalizePath(pathname) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

function getAreaTrail(pathname) {
  const match = pathname.match(/^\/northern-colorado-areas\/([^/]+)$/);
  if (!match) return null;

  const slug = match[1];
  const cityLabel = breadcrumbMap[slug] || slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return [
    { path: "/", label: "Home" },
    { path: "/northern-colorado-areas/", label: "Northern Colorado Communities" },
    { path: `/northern-colorado-areas/${slug}/`, label: `${cityLabel}, CO` },
  ];
}

function getBlogTrail(pathname) {
  const match = pathname.match(/^\/blog\/([^/]+)$/);
  if (!match) return null;

  const slug = match[1];
  const post = getBlogPost(slug);

  return [
    { path: "/", label: "Home" },
    { path: "/blog/", label: "Blog" },
    { path: `/blog/${slug}/`, label: post?.title || slug },
  ];
}

function getTrail(pathname) {
  const normalized = normalizePath(pathname);
  if (normalized === "" || normalized === "/") return null;

  if (customTrails[normalized]) {
    return customTrails[normalized];
  }

  const areaTrail = getAreaTrail(normalized);
  if (areaTrail) return areaTrail;

  const blogTrail = getBlogTrail(normalized);
  if (blogTrail) return blogTrail;

  const pathnames = normalized.split("/").filter(Boolean);
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

  return (
    <nav aria-label="Breadcrumb" className="sr-only">
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
