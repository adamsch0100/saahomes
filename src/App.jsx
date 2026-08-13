import React, { useEffect, Suspense, lazy } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Breadcrumbs from "./components/Breadcrumbs.jsx";
// Critical path — keep eager for first paint / search UX (home, search, detail)
import HomePage from "./pages/HomePage.jsx";
import PropertiesPage from "./pages/PropertiesPage.jsx";
import ListingDetailPage from "./pages/ListingDetailPage.jsx";
import { CITY_HOMES } from "./data/cityHomesData.js";
import FloatingContactBar from "./components/FloatingContactBar.jsx";
import LeadCaptureChat from "./components/LeadCaptureChat.jsx";
import { loadRealScoutScript } from "./utils/realscout.js";
import { GA4_MEASUREMENT_ID, initGaDebugMode } from "./utils/analytics.js";
import { TenantProvider, TenantDocumentTitle } from "./context/TenantContext.jsx";

// Route-level code splitting — marketing, area, admin, blog, tools (lazy)
const AboutPage = lazy(() => import("./pages/AboutPage.jsx"));
const ContactPage = lazy(() => import("./pages/ContactPage.jsx"));
const ForBuyersPage = lazy(() => import("./pages/ForBuyersPage.jsx"));
const ForSellersPage = lazy(() => import("./pages/ForSellersPage.jsx"));
const LuxuryRealEstatePage = lazy(() => import("./pages/LuxuryRealEstatePage.jsx"));
const VeteransPage = lazy(() => import("./pages/VeteransPage.jsx"));
const AssumableMortgagesPage = lazy(() => import("./pages/AssumableMortgagesPage.jsx"));
const CashHomeBuyersPage = lazy(() => import("./pages/CashHomeBuyersPage.jsx"));
const FeaturedAreasPage = lazy(() => import("./pages/FeaturedAreasPage.jsx"));
const CityHomesForSalePage = lazy(() => import("./pages/CityHomesForSalePage.jsx"));
const ManageAlertsPage = lazy(() => import("./pages/ManageAlertsPage.jsx"));
const MyHomePage = lazy(() => import("./pages/MyHomePage.jsx"));
const NotificationCenterPage = lazy(() => import("./pages/NotificationCenterPage.jsx"));
const FortCollinsPage = lazy(() => import("./pages/areas/FortCollinsPage.jsx"));
const LovelandPage = lazy(() => import("./pages/areas/LovelandPage.jsx"));
const MeadPage = lazy(() => import("./pages/areas/MeadPage.jsx"));
const LongmontPage = lazy(() => import("./pages/areas/LongmontPage.jsx"));
const BoulderPage = lazy(() => import("./pages/areas/BoulderPage.jsx"));
const WindsorPage = lazy(() => import("./pages/areas/WindsorPage.jsx"));
const GreeleyPage = lazy(() => import("./pages/areas/GreeleyPage.jsx"));
const TimnathPage = lazy(() => import("./pages/areas/TimnathPage.jsx"));
const WellingtonPage = lazy(() => import("./pages/areas/WellingtonPage.jsx"));
const JohnstownPage = lazy(() => import("./pages/areas/JohnstownPage.jsx"));
const EatonPage = lazy(() => import("./pages/areas/EatonPage.jsx"));
const MillikenPage = lazy(() => import("./pages/areas/MillikenPage.jsx"));
const LaSallePage = lazy(() => import("./pages/areas/LaSallePage.jsx"));
const MortgageCalculatorPage = lazy(() => import("./pages/MortgageCalculatorPage.jsx"));
const AdminPage = lazy(() => import("./pages/AdminPage.jsx"));
const AgentPage = lazy(() => import("./pages/AgentPage.jsx"));
const TestimonialsPage = lazy(() => import("./pages/TestimonialsPage.jsx"));
const EventsCalendarPage = lazy(() => import("./pages/EventsCalendarPage.jsx"));
const BlogPage = lazy(() => import("./pages/BlogPage.jsx"));
const BlogPostPage = lazy(() => import("./pages/BlogPostPage.jsx"));
const ChfaSchoolsToHomePage = lazy(() => import("./pages/ChfaSchoolsToHomePage.jsx"));
const ChampionsHomeLoanPage = lazy(() => import("./pages/ChampionsHomeLoanPage.jsx"));
const ChfaDownPaymentAssistancePage = lazy(() => import("./pages/ChfaDownPaymentAssistancePage.jsx"));
const GHopeHomeLoanPage = lazy(() => import("./pages/GHopeHomeLoanPage.jsx"));
const AreaGuidePage = lazy(() => import("./pages/AreaGuidePage.jsx"));
const NeighborhoodPage = lazy(() => import("./pages/NeighborhoodPage.jsx"));

/** Branded route-load fallback — gold/black skeleton, never blank */
function PageLoadFallback() {
  return (
    <div
      className="min-h-[50vh] w-full animate-pulse"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="bg-black pt-28 sm:pt-32 pb-10">
        <div className="max-w-7xl mx-auto px-6 space-y-4">
          <div className="h-3 w-24 rounded bg-[#CFB36E]/40" />
          <div className="h-10 w-2/3 max-w-lg rounded bg-white/10" />
          <div className="h-4 w-1/2 max-w-md rounded bg-white/10" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="h-40 rounded-xl bg-gray-100" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-24 rounded-lg bg-gray-50" />
      </div>
    </div>
  );
}

function LazyPage({ children }) {
  return <Suspense fallback={<PageLoadFallback />}>{children}</Suspense>;
}

function AppLayout({ children }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isAgentPage = location.pathname.startsWith('/agent');
  // Full-screen Zillow-style search — no page chrome below the header
  const isPropertiesSearch =
    location.pathname === '/properties' || location.pathname === '/properties/';
  
  // App consoles (admin + agent) — no marketing chrome
  if (isAdminPage || isAgentPage) {
    return <>{children}</>;
  }
  
  return (
    <>
      <Header />
      <Breadcrumbs />
      <main
        id="page-container"
        className={
          isPropertiesSearch
            ? "w-full overflow-hidden"
            : "w-full pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0"
        }
      >
        {children}
      </main>
      {!isPropertiesSearch && <FloatingContactBar />}
      <LeadCaptureChat />
      {!isPropertiesSearch && <Footer />}
    </>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    // Load RealScout script when app mounts
    loadRealScoutScript().catch((error) => {
      console.error('Error loading RealScout script:', error);
    });
  }, []);

  // Scroll to top when navigating to properties page
  useEffect(() => {
    if (location.pathname === '/properties' || location.pathname === '/properties/') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [location.pathname]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    initGaDebugMode(searchParams);

    if (typeof window.gtag === 'function') {
      window.gtag('config', GA4_MEASUREMENT_ID, {
        page_path: location.pathname + location.search,
      });
    }
  }, [location.pathname, location.search]);
  
  return (
    <TenantProvider>
    <div className="min-h-screen w-full bg-white text-gray-900">
      <Routes>
        <Route path="/admin" element={<AppLayout><LazyPage><AdminPage /></LazyPage></AppLayout>} />
        <Route path="/admin/" element={<AppLayout><LazyPage><AdminPage /></LazyPage></AppLayout>} />
        <Route path="/agent" element={<AppLayout><LazyPage><AgentPage /></LazyPage></AppLayout>} />
        <Route path="/agent/" element={<AppLayout><LazyPage><AgentPage /></LazyPage></AppLayout>} />
        {/* Critical path — eager */}
        <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
        <Route path="/about-us" element={<AppLayout><LazyPage><AboutPage /></LazyPage></AppLayout>} />
        <Route path="/about-us/" element={<AppLayout><LazyPage><AboutPage /></LazyPage></AppLayout>} />
        <Route path="/contact" element={<AppLayout><LazyPage><ContactPage /></LazyPage></AppLayout>} />
        <Route path="/contact/" element={<AppLayout><LazyPage><ContactPage /></LazyPage></AppLayout>} />
        <Route path="/for-buyers" element={<AppLayout><LazyPage><ForBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/for-buyers/" element={<AppLayout><LazyPage><ForBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/buyers" element={<AppLayout><LazyPage><ForBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/buyers/" element={<AppLayout><LazyPage><ForBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/for-sellers" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/for-sellers/" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/luxury-real-estate" element={<AppLayout><LazyPage><LuxuryRealEstatePage /></LazyPage></AppLayout>} />
        <Route path="/luxury-real-estate/" element={<AppLayout><LazyPage><LuxuryRealEstatePage /></LazyPage></AppLayout>} />
        <Route path="/veterans" element={<AppLayout><LazyPage><VeteransPage /></LazyPage></AppLayout>} />
        <Route path="/veterans/" element={<AppLayout><LazyPage><VeteransPage /></LazyPage></AppLayout>} />
        <Route path="/assumable-mortgages" element={<AppLayout><LazyPage><AssumableMortgagesPage /></LazyPage></AppLayout>} />
        <Route path="/assumable-mortgages/" element={<AppLayout><LazyPage><AssumableMortgagesPage /></LazyPage></AppLayout>} />
        <Route path="/cash-home-buyers" element={<AppLayout><LazyPage><CashHomeBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/cash-home-buyers/" element={<AppLayout><LazyPage><CashHomeBuyersPage /></LazyPage></AppLayout>} />
        <Route path="/featured-areas" element={<AppLayout><LazyPage><FeaturedAreasPage /></LazyPage></AppLayout>} />
        <Route path="/featured-areas/" element={<AppLayout><LazyPage><FeaturedAreasPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas" element={<AppLayout><LazyPage><FeaturedAreasPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/" element={<AppLayout><LazyPage><FeaturedAreasPage /></LazyPage></AppLayout>} />
        
        {/* Area Pages */}
        <Route path="/northern-colorado-areas/fort-collins" element={<AppLayout><LazyPage><FortCollinsPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/fort-collins/" element={<AppLayout><LazyPage><FortCollinsPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/loveland" element={<AppLayout><LazyPage><LovelandPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/loveland/" element={<AppLayout><LazyPage><LovelandPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/mead" element={<AppLayout><LazyPage><MeadPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/mead/" element={<AppLayout><LazyPage><MeadPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/longmont" element={<AppLayout><LazyPage><LongmontPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/longmont/" element={<AppLayout><LazyPage><LongmontPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/boulder" element={<AppLayout><LazyPage><BoulderPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/boulder/" element={<AppLayout><LazyPage><BoulderPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/windsor" element={<AppLayout><LazyPage><WindsorPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/windsor/" element={<AppLayout><LazyPage><WindsorPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/greeley" element={<AppLayout><LazyPage><GreeleyPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/greeley/" element={<AppLayout><LazyPage><GreeleyPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/timnath" element={<AppLayout><LazyPage><TimnathPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/timnath/" element={<AppLayout><LazyPage><TimnathPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/wellington" element={<AppLayout><LazyPage><WellingtonPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/wellington/" element={<AppLayout><LazyPage><WellingtonPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/johnstown" element={<AppLayout><LazyPage><JohnstownPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/johnstown/" element={<AppLayout><LazyPage><JohnstownPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/eaton" element={<AppLayout><LazyPage><EatonPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/eaton/" element={<AppLayout><LazyPage><EatonPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/milliken" element={<AppLayout><LazyPage><MillikenPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/milliken/" element={<AppLayout><LazyPage><MillikenPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/la-salle" element={<AppLayout><LazyPage><LaSallePage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/la-salle/" element={<AppLayout><LazyPage><LaSallePage /></LazyPage></AppLayout>} />
        
        {/* Neighborhood Pages (3-level path, must come before 2-level :slug fallback) */}
        <Route path="/northern-colorado-areas/:city/:neighborhood" element={<AppLayout><LazyPage><NeighborhoodPage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/:city/:neighborhood/" element={<AppLayout><LazyPage><NeighborhoodPage /></LazyPage></AppLayout>} />
        
        <Route path="/northern-colorado-areas/:slug" element={<AppLayout><LazyPage><AreaGuidePage /></LazyPage></AppLayout>} />
        <Route path="/northern-colorado-areas/:slug/" element={<AppLayout><LazyPage><AreaGuidePage /></LazyPage></AppLayout>} />
        
        {/* Property Search Page — critical path, eager */}
        <Route path="/properties" element={<AppLayout><PropertiesPage /></AppLayout>} />
        <Route path="/properties/" element={<AppLayout><PropertiesPage /></AppLayout>} />
        <Route path="/alerts/manage" element={<AppLayout><LazyPage><ManageAlertsPage /></LazyPage></AppLayout>} />
        <Route path="/alerts/manage/" element={<AppLayout><LazyPage><ManageAlertsPage /></LazyPage></AppLayout>} />
        <Route path="/my-saved-searches" element={<AppLayout><LazyPage><ManageAlertsPage /></LazyPage></AppLayout>} />
        <Route path="/my-saved-searches/" element={<AppLayout><LazyPage><ManageAlertsPage /></LazyPage></AppLayout>} />
        <Route path="/my-home" element={<AppLayout><LazyPage><MyHomePage /></LazyPage></AppLayout>} />
        <Route path="/my-home/" element={<AppLayout><LazyPage><MyHomePage /></LazyPage></AppLayout>} />
        <Route path="/notifications" element={<AppLayout><LazyPage><NotificationCenterPage /></LazyPage></AppLayout>} />
        <Route path="/notifications/" element={<AppLayout><LazyPage><NotificationCenterPage /></LazyPage></AppLayout>} />
        <Route path="/homes-for-sale/:slug" element={<AppLayout><ListingDetailPage /></AppLayout>} />

        {/* City homes-for-sale SEO pages */}
        {CITY_HOMES.map((c) => (
          <React.Fragment key={c.slug}>
            <Route path={`/${c.slug}-homes-for-sale`} element={<AppLayout><LazyPage><CityHomesForSalePage /></LazyPage></AppLayout>} />
            <Route path={`/${c.slug}-homes-for-sale/`} element={<AppLayout><LazyPage><CityHomesForSalePage /></LazyPage></AppLayout>} />
          </React.Fragment>
        ))}
        <Route path="/homes-for-sale/:slug/" element={<AppLayout><ListingDetailPage /></AppLayout>} />
        <Route path="/home-valuation" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/home-valuation/" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/whats-my-home-worth" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/whats-my-home-worth/" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/sellers" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        <Route path="/sellers/" element={<AppLayout><LazyPage><ForSellersPage /></LazyPage></AppLayout>} />
        
        {/* Mortgage Calculator */}
        <Route path="/mortgage-calculator" element={<AppLayout><LazyPage><MortgageCalculatorPage /></LazyPage></AppLayout>} />
        <Route path="/mortgage-calculator/" element={<AppLayout><LazyPage><MortgageCalculatorPage /></LazyPage></AppLayout>} />

        {/* CHFA Down Payment Assistance */}
        <Route path="/chfa-down-payment-assistance" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />
        <Route path="/chfa-down-payment-assistance/" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />
        <Route path="/colorado-chfa-down-payment-assistance" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />
        <Route path="/colorado-chfa-down-payment-assistance/" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />
        <Route path="/chfa-dpa" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />
        <Route path="/chfa-dpa/" element={<AppLayout><LazyPage><ChfaDownPaymentAssistancePage /></LazyPage></AppLayout>} />

        {/* G-HOPE Greeley Down Payment Assistance */}
        <Route path="/greeley-g-hope-down-payment-assistance" element={<AppLayout><LazyPage><GHopeHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/greeley-g-hope-down-payment-assistance/" element={<AppLayout><LazyPage><GHopeHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/g-hope-greeley" element={<AppLayout><LazyPage><GHopeHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/g-hope-greeley/" element={<AppLayout><LazyPage><GHopeHomeLoanPage /></LazyPage></AppLayout>} />

        {/* CHFA Schools To Home */}
        <Route path="/chfa-schools-to-home" element={<AppLayout><LazyPage><ChfaSchoolsToHomePage /></LazyPage></AppLayout>} />
        <Route path="/chfa-schools-to-home/" element={<AppLayout><LazyPage><ChfaSchoolsToHomePage /></LazyPage></AppLayout>} />
        <Route path="/chfa" element={<AppLayout><LazyPage><ChfaSchoolsToHomePage /></LazyPage></AppLayout>} />
        <Route path="/chfa/" element={<AppLayout><LazyPage><ChfaSchoolsToHomePage /></LazyPage></AppLayout>} />

        {/* Colorado Champions Home Loan Program */}
        <Route path="/colorado-champions-home-loan-program" element={<AppLayout><LazyPage><ChampionsHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/colorado-champions-home-loan-program/" element={<AppLayout><LazyPage><ChampionsHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/champions-home-loan" element={<AppLayout><LazyPage><ChampionsHomeLoanPage /></LazyPage></AppLayout>} />
        <Route path="/champions-home-loan/" element={<AppLayout><LazyPage><ChampionsHomeLoanPage /></LazyPage></AppLayout>} />

        {/* Testimonials */}
        <Route path="/testimonials" element={<AppLayout><LazyPage><TestimonialsPage /></LazyPage></AppLayout>} />
        <Route path="/testimonials/" element={<AppLayout><LazyPage><TestimonialsPage /></LazyPage></AppLayout>} />
        <Route path="/events" element={<AppLayout><LazyPage><EventsCalendarPage /></LazyPage></AppLayout>} />
        <Route path="/events/" element={<AppLayout><LazyPage><EventsCalendarPage /></LazyPage></AppLayout>} />

        {/* Blog */}
        <Route path="/blog" element={<AppLayout><LazyPage><BlogPage /></LazyPage></AppLayout>} />
        <Route path="/blog/" element={<AppLayout><LazyPage><BlogPage /></LazyPage></AppLayout>} />
        <Route path="/blog/:slug" element={<AppLayout><LazyPage><BlogPostPage /></LazyPage></AppLayout>} />
        <Route path="/blog/:slug/" element={<AppLayout><LazyPage><BlogPostPage /></LazyPage></AppLayout>} />
        <Route path="/helpful-guides" element={<AppLayout><LazyPage><BlogPage /></LazyPage></AppLayout>} />
        <Route path="/helpful-guides/" element={<AppLayout><LazyPage><BlogPage /></LazyPage></AppLayout>} />
      </Routes>
    </div>
    <TenantDocumentTitle />
    </TenantProvider>
  );
}
