import React from "react";
import Header from "./components/Header.jsx";
import Hero from "./components/Hero.jsx";
import Explore from "./components/Explore.jsx";
import About from "./components/About.jsx";
import ContactCTA from "./components/ContactCTA.jsx";
import Footer from "./components/Footer.jsx";

export default function App() {
  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      <Header />
      <main id="page-container" className="w-full">
        <Hero />
        <Explore />
        <About />
        <ContactCTA />
      </main>
      <Footer />
    </div>
  );
}