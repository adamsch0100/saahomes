import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // Don't show breadcrumbs on homepage
  if (pathnames.length === 0) return null;

  const breadcrumbMap = {
    'about-us': 'About Us',
    'for-buyers': 'For Buyers',
    'for-sellers': 'For Sellers',
    'contact': 'Contact',
    'featured-areas': 'Featured Areas',
    'northern-colorado-areas': 'Northern Colorado Areas',
    'fort-collins': 'Fort Collins',
    'loveland': 'Loveland',
    'windsor': 'Windsor',
    'greeley': 'Greeley',
    'timnath': 'Timnath',
    'wellington': 'Wellington',
    'johnstown': 'Johnstown',
    'eaton': 'Eaton',
    'milliken': 'Milliken',
    'la-salle': 'La Salle',
    'mead': 'Mead',
    'longmont': 'Longmont',
    'boulder': 'Boulder',
  };

  return (
    <nav className="sr-only" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2 text-sm text-gray-600 max-w-7xl mx-auto" itemScope itemType="https://schema.org/BreadcrumbList">
        <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
          <Link to="/" itemProp="item">
            <span itemProp="name">Home</span>
          </Link>
          <meta itemProp="position" content="1" />
        </li>
        {pathnames.map((name, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
          const isLast = index === pathnames.length - 1;
          const displayName = breadcrumbMap[name] || name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

          return (
            <li key={name} className="flex items-center" itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
              <span className="mx-2">/</span>
              {isLast ? (
                <span itemProp="name">{displayName}</span>
              ) : (
                <Link to={routeTo} itemProp="item">
                  <span itemProp="name">{displayName}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 2)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

