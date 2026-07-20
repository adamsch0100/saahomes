import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { submitContactForm } from "../utils/api.js";

const CHAT_NAME = "Mandi"; // Real team member — builds authentic connection
const CHAT_TITLE = "Your NoCo Agent";

const PAGE_CONTEXTS = [
  { pattern: /chfa-schools-to-home|chfa-dpa|chfa-down-payment|colorado-champions|champions-home-loan|greeley-g-hope|g-hope/,
    greeting: `I can help with down payment assistance! CHFA, teacher programs, first responder loans — just tell me what you're interested in.`,
    formLabel: "Get CHFA Help",
    leadType: "chfa_interest" },
  { pattern: /for-buyers|buying/,
    greeting: `Looking for your first home? Upgrading? I'd love to help you find the right place in Northern Colorado.`,
    formLabel: "Start Home Search",
    leadType: "buyer_inquiry" },
  { pattern: /for-sellers|sell(ing|er)/,
    greeting: `Thinking of selling? I can pull recent sales in your neighborhood and give you a clear picture of what your home is worth.`,
    formLabel: "Get a Market Report",
    leadType: "seller_inquiry" },
  { pattern: /northern-colorado-areas\/\w+\/\w+/,
    greeting: `Great choice! I know this neighborhood well. Want me to send you listings that match what you're looking for?`,
    formLabel: "Send Me Listings",
    leadType: "neighborhood_interest" },
  { pattern: /northern-colorado-areas/,
    greeting: `Trying to decide between cities? I've helped families in all 19 Northern Colorado communities — happy to compare them for you.`,
    formLabel: "Compare Cities",
    leadType: "area_interest" },
  { pattern: /properties|home-valuation|whats-my-home/,
    greeting: `Found something you like? Or want me to set up a custom search so new listings come straight to you?`,
    formLabel: "Set Up Alerts",
    leadType: "property_search" },
  { pattern: /mortgage-calculator/,
    greeting: `Crunching numbers? I can connect you with a trusted lender who knows CHFA programs inside out.`,
    formLabel: "Connect With a Lender",
    leadType: "mortgage_help" },
  { pattern: /luxury/,
    greeting: `Looking for premium properties? We specialize in luxury homes across Northern Colorado.`,
    formLabel: "Browse Luxury Homes",
    leadType: "luxury_interest" },
  { pattern: /cash-home-buyers/,
    greeting: `Need to sell fast? We work with cash buyers and can discuss your options — no obligation.`,
    formLabel: "Get a Cash Offer",
    leadType: "cash_buyer" },
  { pattern: /blog\/./,
    greeting: `Great read! If you have questions about this topic or want to chat more, I'm here.`,
    formLabel: "Ask a Question",
    leadType: "blog_question" },
  { pattern: /contact/,
    greeting: `Hi there! Fill this out and I'll get back to you ASAP. Or call us direct at (970) 999-1407.`,
    formLabel: "Send Message",
    leadType: "contact_page" },
];

const DEFAULT_GREETING = `Hi! I'm ${CHAT_NAME}. Whether you're buying, selling, or just exploring Northern Colorado — I'm here to help.`;
const DEFAULT_LABEL = "Chat With Me";
const DEFAULT_LEAD_TYPE = "general_chat";

export default function LeadCaptureChat() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("greeting");
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const chatRef = useRef(null);
  const nudgeTimer = useRef(null);
  const scrollTimer = useRef(null);

  const matchedContext = PAGE_CONTEXTS.find((ctx) => ctx.pattern.test(location.pathname));
  const greeting = matchedContext?.greeting || DEFAULT_GREETING;
  const formLabel = matchedContext?.formLabel || DEFAULT_LABEL;
  const leadType = matchedContext?.leadType || DEFAULT_LEAD_TYPE;

  // Smart trigger: show nudge after 20s on page OR 40% scroll depth
  useEffect(() => {
    if (hasInteracted) return;

    // Time-based trigger (20s)
    nudgeTimer.current = setTimeout(() => {
      if (!hasInteracted) setShowNudge(true);
    }, 20000);

    // Scroll-based trigger (40% depth)
    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (scrollPercent > 0.4 && !hasInteracted) {
        setShowNudge(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimeout(nudgeTimer.current);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [hasInteracted, location.pathname]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (chatRef.current && !chatRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Reset on page nav
  useEffect(() => {
    setStep("greeting");
    setFormData({ name: "", email: "", phone: "", message: "" });
    setError(null);
    setShowNudge(false);
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
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        interest: leadType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        message: formData.message || `Chat from ${location.pathname}`,
        sourcePage: window.location.pathname,
      });
      setStep("submitted");
      if (typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", {
          lead_type: leadType,
          page: location.pathname,
        });
      }
    } catch (err) {
      setError("Couldn't send. Call (970) 999-1407 and I'll help right away.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setShowNudge(false);
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
      <style>{`
        @keyframes chatSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          50% { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.25); }
        }
        @keyframes chatNudgeDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes chatPreviewSlide {
          from { opacity: 0; transform: translateX(12px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* Preview bubble (appears before they click — shows the greeting teaser) */}
      {!isOpen && showNudge && (
        <button
          onClick={handleOpen}
          className="mb-3 bg-white rounded-2xl shadow-xl border border-gray-100 px-5 py-3 max-w-[260px] text-left hover:shadow-2xl transition-shadow cursor-pointer"
          style={{ animation: 'chatPreviewSlide 0.35s ease-out' }}
        >
          <div className="flex items-start gap-2">
            <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-white text-xs flex-shrink-0 mt-0.5">
              {CHAT_NAME[0]}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-900">{CHAT_NAME}</p>
              <p className="text-sm text-gray-600 leading-snug mt-0.5">{greeting.length > 90 ? greeting.slice(0, 90) + "…" : greeting}</p>
            </div>
          </div>
        </button>
      )}

      {/* Expanded Chat Card */}
      {isOpen && (
        <div
          className="mb-3 w-[340px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: 'chatSlideUp 0.25s ease-out' }}
        >
          {/* Header */}
          <div className="bg-black text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white text-sm font-semibold">
                {CHAT_NAME[0]}
              </div>
              <div>
                <p className="font-semibold text-sm">{CHAT_NAME} — {CHAT_TITLE}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Online — replies in minutes
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none p-1">&times;</button>
          </div>

          {/* Messages Area */}
          <div className="px-5 py-4 min-h-[220px] max-h-[400px] overflow-y-auto">
            {/* Agent message bubble */}
            <div className="flex items-start gap-2.5 mb-4" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-semibold flex-shrink-0 mt-0.5">
                {CHAT_NAME[0]}
              </div>
              <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                <p className="text-gray-800 text-sm leading-relaxed">{greeting}</p>
              </div>
            </div>

            {/* Action buttons or form */}
            {step === "greeting" && (
              <div className="space-y-2 ml-10" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <button
                  onClick={() => setStep("form")}
                  className="w-full px-4 py-3 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors"
                >
                  {formLabel}
                </button>
                <a
                  href="tel:(970) 999-1407"
                  className="block w-full px-4 py-3 border-2 border-black text-black font-semibold rounded-xl text-sm text-center hover:bg-gray-50 transition-colors"
                >
                  Call (970) 999-1407
                </a>
              </div>
            )}

            {step === "form" && (
              <form onSubmit={handleSubmit} className="ml-10" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <p className="text-xs text-gray-500 mb-3">Leave your info and I'll reach out soon.</p>
                <div className="space-y-2.5">
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
                    {isSubmitting ? "Sending..." : formLabel}
                  </button>
                </div>
              </form>
            )}

            {step === "submitted" && (
              <div className="text-center py-6" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                  <span className="text-2xl">&#x2705;</span>
                </div>
                <p className="font-semibold text-gray-900 mb-1">Thanks {formData.name.split(" ")[0]}!</p>
                <p className="text-sm text-gray-600 mb-4">I'll get back to you as soon as possible. In the meantime, feel free to call.</p>
                <a
                  href="tel:(970) 999-1407"
                  className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors"
                >
                  Call (970) 999-1407
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat Bubble Button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white text-xl transition-all duration-200 hover:scale-105 active:scale-95 ${
          isOpen ? "bg-gray-800 rotate-45" : showNudge ? "bg-black" : "bg-black/80 hover:bg-black"
        }`}
        style={!isOpen && showNudge ? { animation: 'chatPulse 2s ease-in-out infinite' } : {}}
        aria-label={`Chat with ${CHAT_NAME}`}
      >
        {isOpen ? (
          <span className="text-2xl font-light">&times;</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
    </div>
  );
}
