import React, { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Breadcrumbs from "./components/Breadcrumbs.jsx";
import HomePage from "./pages/HomePage.jsx";
import AboutPage from "./pages/AboutPage.jsx";
import ContactPage from "./pages/ContactPage.jsx";
import ForBuyersPage from "./pages/ForBuyersPage.jsx";
import ForSellersPage from "./pages/ForSellersPage.jsx";
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
import { loadRealScoutScript } from "./utils/realscout.js";

export default function App() {
  useEffect(() => {
    // Load RealScout script when app mounts
    loadRealScoutScript().catch((error) => {
      console.error('Error loading RealScout script:', error);
    });
  }, []);
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <Header />
      <Breadcrumbs />
      <main id="page-container" className="w-full">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/about-us" element={<AboutPage />} />
          <Route path="/about-us/" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/contact/" element={<ContactPage />} />
          <Route path="/for-buyers" element={<ForBuyersPage />} />
          <Route path="/for-buyers/" element={<ForBuyersPage />} />
          <Route path="/for-sellers" element={<ForSellersPage />} />
          <Route path="/for-sellers/" element={<ForSellersPage />} />
          <Route path="/featured-areas" element={<FeaturedAreasPage />} />
          <Route path="/featured-areas/" element={<FeaturedAreasPage />} />
          <Route path="/northern-colorado-areas" element={<FeaturedAreasPage />} />
          <Route path="/northern-colorado-areas/" element={<FeaturedAreasPage />} />
          
          {/* Area Pages */}
          <Route path="/northern-colorado-areas/fort-collins" element={<FortCollinsPage />} />
          <Route path="/northern-colorado-areas/fort-collins/" element={<FortCollinsPage />} />
          <Route path="/northern-colorado-areas/loveland" element={<LovelandPage />} />
          <Route path="/northern-colorado-areas/loveland/" element={<LovelandPage />} />
          <Route path="/northern-colorado-areas/mead" element={<MeadPage />} />
          <Route path="/northern-colorado-areas/mead/" element={<MeadPage />} />
          <Route path="/northern-colorado-areas/longmont" element={<LongmontPage />} />
          <Route path="/northern-colorado-areas/longmont/" element={<LongmontPage />} />
          <Route path="/northern-colorado-areas/boulder" element={<BoulderPage />} />
          <Route path="/northern-colorado-areas/boulder/" element={<BoulderPage />} />
          <Route path="/northern-colorado-areas/windsor" element={<WindsorPage />} />
          <Route path="/northern-colorado-areas/windsor/" element={<WindsorPage />} />
          <Route path="/northern-colorado-areas/greeley" element={<GreeleyPage />} />
          <Route path="/northern-colorado-areas/greeley/" element={<GreeleyPage />} />
          <Route path="/northern-colorado-areas/timnath" element={<TimnathPage />} />
          <Route path="/northern-colorado-areas/timnath/" element={<TimnathPage />} />
          <Route path="/northern-colorado-areas/wellington" element={<WellingtonPage />} />
          <Route path="/northern-colorado-areas/wellington/" element={<WellingtonPage />} />
          <Route path="/northern-colorado-areas/johnstown" element={<JohnstownPage />} />
          <Route path="/northern-colorado-areas/johnstown/" element={<JohnstownPage />} />
          <Route path="/northern-colorado-areas/eaton" element={<EatonPage />} />
          <Route path="/northern-colorado-areas/eaton/" element={<EatonPage />} />
          <Route path="/northern-colorado-areas/milliken" element={<MillikenPage />} />
          <Route path="/northern-colorado-areas/milliken/" element={<MillikenPage />} />
          <Route path="/northern-colorado-areas/la-salle" element={<LaSallePage />} />
          <Route path="/northern-colorado-areas/la-salle/" element={<LaSallePage />} />
          
          {/* Property Search Page */}
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/properties/" element={<PropertiesPage />} />
          <Route path="/home-valuation" element={<ForSellersPage />} />
          <Route path="/home-valuation/" element={<ForSellersPage />} />
          <Route path="/whats-my-home-worth" element={<ForSellersPage />} />
          <Route path="/whats-my-home-worth/" element={<ForSellersPage />} />
          <Route path="/sellers" element={<ForSellersPage />} />
          <Route path="/sellers/" element={<ForSellersPage />} />
          
          {/* Mortgage Calculator */}
          <Route path="/mortgage-calculator" element={<MortgageCalculatorPage />} />
          <Route path="/mortgage-calculator/" element={<MortgageCalculatorPage />} />
          
          {/* Admin Panel */}
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/" element={<AdminPage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
