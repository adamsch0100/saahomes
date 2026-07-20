import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { submitContactForm } from "../utils/api.js";

const PAGE_CONTEXTS = [
  { pattern: /chfa-schools-to-home|chfa-dpa|chfa-down-payment|colorado-champions|champions-home-loan|greeley-g-hope|g-hope/,
    greeting: "Looking into down payment assistance? I can help explain your options.",
    agentLabel: "Talk to a CHFA Specialist",
    leadType: "chfa_interest" },
  { pattern: /for-buyers|buying|for-sellers|sell(ing|er)/,
    greeting: "Thinking about buying or selling in Northern Colorado? Let's chat about your goals.",
    agentLabel: "Talk to an Agent Now",
    leadType: "buy_sell_inquiry" },
  { pattern: /northern-colorado-areas\/\w+\/\w+/,
    greeting: "Great neighborhood choice! Want details on homes for sale here?",
    agentLabel: "See Available Homes",
    leadType: "neighborhood_interest" },
  { pattern: /northern-colorado-areas/,
    greeting: "Exploring Northern Colorado cities? I can help compare neighborhoods and prices.",
    agentLabel: "Compare Cities",
    leadType: "area_interest" },
  { pattern: /properties|home-valuation|whats-my-home/,
    greeting: "Searching for your next home? Tell me what you're looking for.",
    agentLabel: "Start Your Search",
    leadType: "property_search" },
  { pattern: /mortgage-calculator/,
    greeting: "Crunching numbers? I can help connect you with a lender to get pre-approved.",
    agentLabel: "Connect With a Lender",
    leadType: "mortgage_help" },
  { pattern: /luxury/,
    greeting: "Interested in luxury properties? We specialize in premium Northern Colorado homes.",
    agentLabel: "Explore Luxury Listings",
    leadType: "luxury_interest" },
  { pattern: /cash-home-buyers/,
    greeting: "Need to sell quickly? We can discuss your options for a cash offer.",
    agentLabel: "Get a Cash Offer",
    leadType: "cash_buyer" },
  { pattern: /blog\/./,
    greeting: "Great article! Want to chat more about this topic?",
    agentLabel: "Ask a Question",
    leadType: "blog_question" },
];

const DEFAULT_GREETING = "Hi! How can we help you with your Northern Colorado real estate journey?";
const DEFAULT_LABEL = "Talk to an Agent";
const DEFAULT_LEAD_TYPE = "general_chat";

export default function LeadCaptureChat() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("greeting");
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const chatRef = useRef(null);

  const matchedContext = PAGE_CONTEXTS.find((ctx) => ctx.pattern.test(location.pathname));
  const greeting = matchedContext?.greeting || DEFAULT_GREETING;
  const agentLabel = matchedContext?.agentLabel || DEFAULT_LABEL;
  const leadType = matchedContext?.leadType || DEFAULT_LEAD_TYPE;

  useEffect(() => {
    function handleClick(e) {
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  useEffect(() => {
    setStep("greeting");
    setFormData({ name: "", email: "", phone: "", message: "" });
    setError(null);
  }, [location.pathname]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await submitContactForm({
        ...formData,
        sourcePage: window.location.pathname,
        leadType,
        message: formData.message || `Chat inquiry from ${location.pathname}`,
      });
      setStep("submitted");
      if (typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", {
          lead_type: leadType,
          page: location.pathname,
        });
      }
    } catch (err) {
      setError("Couldn't send. Call (970) 999-1407 and we'll help right away.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    if (!hasInteracted) {
      setHasInteracted(true);
      if (typeof window.gtag === "function") {
        window.gtag("event", "chat_opened", { page: location.pathname });
      }
    }
  };

  const formatPhone = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (digits.length > 3) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return digits;
  };

  return (
    <div ref={chatRef} className="fixed bottom-28 right-4 sm:bottom-8 sm:right-8 z-50 flex flex-col items-end">
      {/* Inline animation keyframes */}
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Chat Card */}
      {isOpen && (
        <div
          className="mb-3 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: 'chatSlideUp 0.25s ease-out' }}
        >
          {/* Header */}
          <div className="bg-black text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-lg text-white">&#x1F3E0;</div>
              <div>
                <p className="font-semibold text-sm">SAA Homes</p>
                <p className="text-xs text-gray-400">Usually replies in minutes</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none p-1">&times;</button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 min-h-[200px]">
            {step === "greeting" && (
              <div style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 mb-4 inline-block max-w-[90%]">
                  <p className="text-gray-800 text-sm leading-relaxed">{greeting}</p>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => setStep("form")}
                    className="w-full px-4 py-3 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors"
                  >
                    {agentLabel}
                  </button>
                  <a
                    href="tel:(970) 999-1407"
                    className="block w-full px-4 py-3 border-2 border-black text-black font-semibold rounded-xl text-sm text-center hover:bg-gray-50 transition-colors"
                  >
                    Call (970) 999-1407
                  </a>
                </div>
              </div>
            )}

            {step === "form" && (
              <form onSubmit={handleSubmit} style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <p className="text-sm text-gray-600 mb-4">Leave your info and we'll reach out soon.</p>
                <div className="space-y-3">
                  <input
                    name="name" required placeholder="Your name *"
                    value={formData.name} onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                  <input
                    name="email" type="email" required placeholder="your@email.com *"
                    value={formData.email} onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                  <input
                    name="phone" type="tel" placeholder="(970) 555-0123"
                    value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: formatPhone(e.target.value) })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                  <textarea
                    name="message" rows="2" placeholder="What are you looking for?"
                    value={formData.message} onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none"
                  />
                  {error && <p className="text-red-600 text-xs">{error}</p>}
                  <button
                    type="submit" disabled={isSubmitting}
                    className="w-full px-4 py-3 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? "Sending..." : "Send Message"}
                  </button>
                </div>
              </form>
            )}

            {step === "submitted" && (
              <div className="text-center py-6" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <div className="text-4xl mb-3">&#x2705;</div>
                <p className="font-semibold text-gray-900 mb-1">Message sent!</p>
                <p className="text-sm text-gray-600 mb-4">Adam or Mandi will reach out shortly.</p>
                <a
                  href="tel:(970) 999-1407"
                  className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors"
                >
                  Need immediate help? Call Now
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Bubble Button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-2xl transition-all duration-200 hover:scale-105 active:scale-95 ${
          isOpen ? "bg-gray-800 rotate-45" : "bg-black"
        }`}
        aria-label="Chat with SAA Homes"
      >
        {isOpen ? "+" : "\uD83D\uDCAC"}
      </button>
    </div>
  );
}
