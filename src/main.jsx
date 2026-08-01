import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { captureLeadAttribution } from "./utils/leadTracking.js";
import "./index.css";

captureLeadAttribution();

// Remove build-time prerendered JSON-LD scripts before React mounts.
// Prerender (scripts/prerender-meta.mjs) injects schemas into static HTML for
// crawlers; React Helmet re-injects them on hydration, duplicating every schema
// except WebSite (4/5 types duplicated on area pages). Stripping here lets
// Helmet be the single source of truth in the browser while crawlers that
// don't execute JS still see the prerendered schemas.
if (typeof document !== "undefined") {
  document
    .querySelectorAll('script[type="application/ld+json"]')
    .forEach((s) => s.remove());
}

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);