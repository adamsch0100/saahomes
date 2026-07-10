import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Breadcrumbs from "./components/Breadcrumbs.jsx";
import HomePage from "./pages/HomePage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import ForBuyersPage from "./pages/ForBuyersPage.jsx";
import ForSellersPage from "./pages/ForSellersPage.jsx";
import LuxuryRealEstatePage from "./pages/LuxuryRealEstatePage.jsx";
import CashHomeBuyersPage from "./pages/CashHomeBuyersPage.jsx";
import FeaturedAreasPage from "./pages/FeaturedAreasPage.jsx";
import PropertiesPage from "./pages/PropertiesPage.jsx";
import FortCollinsPage from "./pages/areas/FortCollinsPage.jsx";
import LovelandPage from "./pages/areas/LovelandPage.jsx";
import MeadPage from "./pages/areas/MeadPage.jsx";
import LongmontPage from "./pages/areas/LongmontPage.jsx";
import BoulderPage from "./pages/areas/BoulderPage.jsx";
import WindsorPage from "./pages/areas/WindsorPage.jsx";
import GreeleyPage from "./pages/areas/GreeleyPage.jsx";
import TimnathPage from "./pages/areas/TimnathPage.jsx";
import WellingtonPage from "./pages/areas/WellingtonPage.jsx";
import JohnstownPage from "./pages/areas/JohnstownPage.jsx";
import EatonPage from "./pages/areas/EatonPage.jsx";
import MillikenPage from "./pages/areas/MillikenPage.jsx";
import LaSallePage from "./pages/areas/LaSallePage.jsx";
import MortgageCalculatorPage from "./pages/MortgageCalculatorPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import TestimonialsPage from "./pages/TestimonialsPage.jsx";
import BlogPage from "./pages/BlogPage.jsx";
import BlogPostPage from "./pages/BlogPostPage.jsx";
import ChfaSchoolsToHomePage from "./pages/ChfaSchoolsToHomePage.jsx";
import ChampionsHomeLoanPage from "./pages/ChampionsHomeLoanPage.jsx";
import ChfaDownPaymentAssistancePage from "./pages/ChfaDownPaymentAssistancePage.jsx";
import GHopeHomeLoanPage from "./pages/GHopeHomeLoanPage.jsx";
import AreaGuidePage from "./pages/AreaGuidePage.jsx";
import NeighborhoodPage from "./pages/NeighborhoodPage.jsx";
import FloatingContactBar from "./components/FloatingContactBar.jsx";
import { loadRealScoutScript } from "./utils/realscout.js";
import { GA4_MEASUREMENT_ID, initGaDebugMode } from "./utils/analytics.js";

function AppLayout({ children }) {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  
  if (isAdminPage) {
    return <>{children}</>;
  }
  
  return (
    <>
      <Header />
      <Breadcrumbs />
      <main id="page-container" className="w-full pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {children}
      </main>
      <FloatingContactBar />
      <Footer />
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
    <div className="min-h-screen w-full bg-white text-gray-900">
      <Routes>
        <Route path="/admin" element={<AppLayout><AdminPage /></AppLayout>} />
        <Route path="/admin/" element={<AppLayout><AdminPage /></AppLayout>} />
        <Route path="/" element={<AppLayout><HomePage /></AppLayout>} />
        <Route path="/about-us" element={<AppLayout><AboutPage /></AppLayout>} />
        <Route path="/about-us/" element={<AppLayout><AboutPage /></AppLayout>} />
        <Route path="/contact" element={<AppLayout><ContactPage /></AppLayout>} />
        <Route path="/contact/" element={<AppLayout><ContactPage /></AppLayout>} />
        <Route path="/for-buyers" element={<AppLayout><ForBuyersPage /></AppLayout>} />
        <Route path="/for-buyers/" element={<AppLayout><ForBuyersPage /></AppLayout>} />
        <Route path="/buyers" element={<AppLayout><ForBuyersPage /></AppLayout>} />
        <Route path="/buyers/" element={<AppLayout><ForBuyersPage /></AppLayout>} />
        <Route path="/for-sellers" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/for-sellers/" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/luxury-real-estate" element={<AppLayout><LuxuryRealEstatePage /></AppLayout>} />
        <Route path="/luxury-real-estate/" element={<AppLayout><LuxuryRealEstatePage /></AppLayout>} />
        <Route path="/cash-home-buyers" element={<AppLayout><CashHomeBuyersPage /></AppLayout>} />
        <Route path="/cash-home-buyers/" element={<AppLayout><CashHomeBuyersPage /></AppLayout>} />
        <Route path="/featured-areas" element={<AppLayout><FeaturedAreasPage /></AppLayout>} />
        <Route path="/featured-areas/" element={<AppLayout><FeaturedAreasPage /></AppLayout>} />
        <Route path="/northern-colorado-areas" element={<AppLayout><FeaturedAreasPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/" element={<AppLayout><FeaturedAreasPage /></AppLayout>} />
        
        {/* Area Pages */}
        <Route path="/northern-colorado-areas/fort-collins" element={<AppLayout><FortCollinsPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/fort-collins/" element={<AppLayout><FortCollinsPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/loveland" element={<AppLayout><LovelandPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/loveland/" element={<AppLayout><LovelandPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/mead" element={<AppLayout><MeadPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/mead/" element={<AppLayout><MeadPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/longmont" element={<AppLayout><LongmontPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/longmont/" element={<AppLayout><LongmontPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/boulder" element={<AppLayout><BoulderPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/boulder/" element={<AppLayout><BoulderPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/windsor" element={<AppLayout><WindsorPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/windsor/" element={<AppLayout><WindsorPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/greeley" element={<AppLayout><GreeleyPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/greeley/" element={<AppLayout><GreeleyPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/timnath" element={<AppLayout><TimnathPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/timnath/" element={<AppLayout><TimnathPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/wellington" element={<AppLayout><WellingtonPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/wellington/" element={<AppLayout><WellingtonPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/johnstown" element={<AppLayout><JohnstownPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/johnstown/" element={<AppLayout><JohnstownPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/eaton" element={<AppLayout><EatonPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/eaton/" element={<AppLayout><EatonPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/milliken" element={<AppLayout><MillikenPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/milliken/" element={<AppLayout><MillikenPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/la-salle" element={<AppLayout><LaSallePage /></AppLayout>} />
        <Route path="/northern-colorado-areas/la-salle/" element={<AppLayout><LaSallePage /></AppLayout>} />
        
        {/* Neighborhood Pages (3-level path, must come before 2-level :slug fallback) */}
        <Route path="/northern-colorado-areas/:city/:neighborhood" element={<AppLayout><NeighborhoodPage /></AppLayout>} />
        <Route path="/northern-colorado-areas/:city/:neighborhood/" element={<AppLayout><NeighborhoodPage /></AppLayout>} />
        
        <Route path="/northern-colorado-areas/:slug" element={<AppLayout><AreaGuidePage /></AppLayout>} />
        <Route path="/northern-colorado-areas/:slug/" element={<AppLayout><AreaGuidePage /></AppLayout>} />
        
        {/* Property Search Page */}
        <Route path="/properties" element={<AppLayout><PropertiesPage /></AppLayout>} />
        <Route path="/properties/" element={<AppLayout><PropertiesPage /></AppLayout>} />
        <Route path="/home-valuation" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/home-valuation/" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/whats-my-home-worth" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/whats-my-home-worth/" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/sellers" element={<AppLayout><ForSellersPage /></AppLayout>} />
        <Route path="/sellers/" element={<AppLayout><ForSellersPage /></AppLayout>} />
        
        {/* Mortgage Calculator */}
        <Route path="/mortgage-calculator" element={<AppLayout><MortgageCalculatorPage /></AppLayout>} />
        <Route path="/mortgage-calculator/" element={<AppLayout><MortgageCalculatorPage /></AppLayout>} />

        {/* CHFA Down Payment Assistance */}
        <Route path="/chfa-down-payment-assistance" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />
        <Route path="/chfa-down-payment-assistance/" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />
        <Route path="/colorado-chfa-down-payment-assistance" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />
        <Route path="/colorado-chfa-down-payment-assistance/" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />
        <Route path="/chfa-dpa" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />
        <Route path="/chfa-dpa/" element={<AppLayout><ChfaDownPaymentAssistancePage /></AppLayout>} />

        {/* G-HOPE Greeley Down Payment Assistance */}
        <Route path="/greeley-g-hope-down-payment-assistance" element={<AppLayout><GHopeHomeLoanPage /></AppLayout>} />
        <Route path="/greeley-g-hope-down-payment-assistance/" element={<AppLayout><GHopeHomeLoanPage /></AppLayout>} />
        <Route path="/g-hope-greeley" element={<AppLayout><GHopeHomeLoanPage /></AppLayout>} />
        <Route path="/g-hope-greeley/" element={<AppLayout><GHopeHomeLoanPage /></AppLayout>} />

        {/* CHFA Schools To Home */}
        <Route path="/chfa-schools-to-home" element={<AppLayout><ChfaSchoolsToHomePage /></AppLayout>} />
        <Route path="/chfa-schools-to-home/" element={<AppLayout><ChfaSchoolsToHomePage /></AppLayout>} />
        <Route path="/chfa" element={<AppLayout><ChfaSchoolsToHomePage /></AppLayout>} />
        <Route path="/chfa/" element={<AppLayout><ChfaSchoolsToHomePage /></AppLayout>} />

        {/* Colorado Champions Home Loan Program */}
        <Route path="/colorado-champions-home-loan-program" element={<AppLayout><ChampionsHomeLoanPage /></AppLayout>} />
        <Route path="/colorado-champions-home-loan-program/" element={<AppLayout><ChampionsHomeLoanPage /></AppLayout>} />
        <Route path="/champions-home-loan" element={<AppLayout><ChampionsHomeLoanPage /></AppLayout>} />
        <Route path="/champions-home-loan/" element={<AppLayout><ChampionsHomeLoanPage /></AppLayout>} />

        {/* Testimonials */}
        <Route path="/testimonials" element={<AppLayout><TestimonialsPage /></AppLayout>} />
        <Route path="/testimonials/" element={<AppLayout><TestimonialsPage /></AppLayout>} />

        {/* Blog */}
        <Route path="/blog" element={<AppLayout><BlogPage /></AppLayout>} />
        <Route path="/blog/" element={<AppLayout><BlogPage /></AppLayout>} />
        <Route path="/blog/:slug" element={<AppLayout><BlogPostPage /></AppLayout>} />
        <Route path="/blog/:slug/" element={<AppLayout><BlogPostPage /></AppLayout>} />
        <Route path="/helpful-guides" element={<AppLayout><BlogPage /></AppLayout>} />
        <Route path="/helpful-guides/" element={<AppLayout><BlogPage /></AppLayout>} />
      </Routes>
    </div>
  );
}
