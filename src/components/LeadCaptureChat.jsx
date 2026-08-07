import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { submitContactForm } from "../utils/api.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  if (import.meta.env.DEV) return 'http://localhost:3000';
  return '';
})();

const CHAT_NAME = "Nadia";
const CHAT_TITLE = "Real Estate Assistant";
const AVATAR_PATH = "/images/nadia-avatar.jpg";

export default function LeadCaptureChat() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [handoffStep, setHandoffStep] = useState(null); // null | 'collecting' | 'submitted'
  const [leadInfo, setLeadInfo] = useState({ name: "", email: "", phone: "", contactMethod: "email" });
  const [leadError, setLeadError] = useState(null);
  const [showTransferOption, setShowTransferOption] = useState(false);
  const [hasLead, setHasLead] = useState(false);
  const [teaserMessage, setTeaserMessage] = useState("");
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const nudgeTimer = useRef(null);

  // Lead detection: have we already captured this visitor?
  // (localStorage flag is instant; the cookie session is authoritative.)
  useEffect(() => {
    if (localStorage.getItem("saa_lead_captured")) { setHasLead(true); return; }
    fetch(`${API_BASE}/api/alerts/me`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setHasLead(true);
          localStorage.setItem("saa_lead_captured", "1");
        }
      })
      .catch(() => {});
  }, []);

  // Smart teaser — world-class rules:
  //  · Lead captured  → fully passive (launcher only, never pops)
  //  · Unknown visitor → at most ONE teaser per 15 min, ONLY on high-intent
  //    pages (listing / search / city / contact / CHFA), referencing the
  //    listing they're looking at. Never after dismissal or interaction.
  useEffect(() => {
    if (hasInteracted || hasLead) return;
    const path = location.pathname;
    const isListing = path.includes("/homes-for-sale/");
    const isSearch = path.startsWith("/properties");
    const isCity = path.includes("-homes-for-sale/") || path.includes("/northern-colorado-areas/");
    const isIntent = isListing || isSearch || isCity || /(\/contact|\/for-buyers|\/for-sellers|\/chfa)/.test(path);
    if (!isIntent) return;

    const now = Date.now();
    const lastShown = Number(sessionStorage.getItem("nadia_teaser_at") || 0);
    if (sessionStorage.getItem("nadia_teaser_dismissed") || now - lastShown < 15 * 60 * 1000) return;

    let message = "Buying or selling in Northern Colorado? I can help you find your way.";
    if (isListing) {
      const addr = document.querySelector("h1")?.textContent?.trim();
      message = addr ? `Questions about ${addr}? I know this home — ask me anything.` : "Questions about this home? I can tell you more.";
    } else if (isSearch || isCity) {
      const m = document.title.match(/^([A-Za-z ]+?)\s*\|/);
      const city = m ? m[1].trim() : "";
      message = city ? `Looking for a place in ${city}? Save your search and new homes come to you.` : "Looking for a place? Save your search and new homes come to you.";
    }
    setTeaserMessage(message);

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      sessionStorage.setItem("nadia_teaser_at", String(Date.now()));
      setShowNudge(true);
    };
    const timer = setTimeout(fire, 25000);
    const onScroll = () => {
      const total = Math.max(document.body.scrollHeight - window.innerHeight, 1);
      if (window.scrollY / total > 0.5) fire();
    };
    const onLeave = (e) => { if (e.clientY <= 0) fire(); }; // exit intent (desktop)
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [hasInteracted, hasLead, location.pathname]);

  const dismissTeaser = () => {
    setShowNudge(false);
    sessionStorage.setItem("nadia_teaser_dismissed", "1");
  };

  // Open chat programmatically from any CTA via window event.
  // detail: { message: "pre-seeded visitor question" } — optional.
  // Uses a ref so the listener always calls the latest sendMessage closure.
  const sendMessageRef = useRef(null);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });
  useEffect(() => {
    const openChat = (e) => {
      const seed = e?.detail?.message;
      setIsOpen(true);
      setShowNudge(false);
      setHasInteracted(true);
      if (seed && seed.trim()) {
        sendMessageRef.current?.(seed.trim());
      }
    };
    window.addEventListener("open-nadia-chat", openChat);
    return () => window.removeEventListener("open-nadia-chat", openChat);
  }, []);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (chatRef.current && !chatRef.current.contains(e.target)) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Reset on page nav
  useEffect(() => {
    setMessages([]);
    setInput("");
    setHandoffStep(null);
    setShowNudge(false);
    setShowTransferOption(false);
  }, [location.pathname]);

  // Send initial greeting when chat opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetings = {
        chfa: "Hi! 👋 I'm Nadia, your SAA Homes real estate assistant. Looking into down payment assistance? I can help you figure out which CHFA program fits your situation — SmartStep, Schools to Home, Champions, or G-HOPE. What questions can I answer?",
        buyer: "Hey there! 🏡 Thinking about buying a home in Northern Colorado? Whether you're just starting to explore or ready to look at specific neighborhoods, I'm here to help. What are you looking for?",
        seller: "Hi! 📈 Thinking of selling? I can walk you through what your home might be worth in today's market and how our team approaches marketing. What's your timeline looking like?",
        default: "Hi there! 👋 I'm Nadia, your personal real estate assistant at SAA Homes. Whether you're buying, selling, or just curious about Northern Colorado real estate — I'd love to help point you in the right direction. What can I answer for you?",
      };
      const path = location.pathname;
      let greeting = greetings.default;
      if (hasLead) {
        greeting = "Good to see you again! 👋 I'm Nadia. Want to check on your saved searches, or do you have questions about this area? I can help.";
      } else if (/chfa|dpa|champions|g-hope|greeley/.test(path)) greeting = greetings.chfa;
      else if (/for-buyers|buying/.test(path)) greeting = greetings.buyer;
      else if (/for-sellers|sell/.test(path)) greeting = greetings.seller;

      setMessages([{ role: "assistant", content: greeting }]);
    }
  }, [isOpen, location.pathname, hasLead]);

  // Lead-score signal: chat opened (session-gated; silent for guests)
  useEffect(() => {
    if (!isOpen) return;
    fetch(`${API_BASE}/api/alerts/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ type: "chat_opened" }),
    }).catch(() => {});
  }, [isOpen]);

  const sendMessage = async (text) => {
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          page: location.pathname,
        }),
      });

      if (!res.ok) {
        throw new Error("AI service unavailable");
      }

      const data = await res.json();
      const reply = data.reply || "";

      // Strip control tags from displayed content
      const displayReply = reply
        .replace(/^\[\[HANDOFF\]\]\s*\n?/m, '')
        .replace(/^\[\[TRANSFER\]\]\s*\n?/m, '');

      // Check if the AI triggered a handoff or transfer
      if (reply.includes("[[TRANSFER]]")) {
        setShowTransferOption(true);
        setMessages((prev) => [...prev, { role: "assistant", content: displayReply }]);
      } else if (reply.includes("[[HANDOFF]]")) {
        setHandoffStep("collecting");
        setMessages((prev) => [...prev, { role: "assistant", content: displayReply }]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: displayReply }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: `Sorry, I'm having trouble connecting right now. You can always call us direct at (970) 999-1407!`,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    sendMessage(input.trim());
  };

  const handleHandoffSubmit = async (e) => {
    e.preventDefault();
    if (!leadInfo.name || !leadInfo.email) {
      setLeadError("Name and email are required.");
      return;
    }
    if (!leadInfo.phone || !String(leadInfo.phone).trim()) {
      setLeadError("Phone is required so Adam or Mandi can reach you.");
      return;
    }
    setIsTyping(true);
    setLeadError(null);
    try {
      await submitContactForm({
        name: leadInfo.name,
        email: leadInfo.email,
        phone: leadInfo.phone.trim(),
        interest: "Chat Conversation Lead",
        contactMethod: leadInfo.contactMethod || "email",
        message: `Lead from Nadia chat. Page: ${location.pathname}\nPreferred contact: ${leadInfo.contactMethod}\n---\n${messages.map((m) => `${m.role === 'assistant' ? 'Nadia' : 'Visitor'}: ${m.content}`).join('\n')}`,
        sourcePage: location.pathname,
      });
      setHandoffStep("submitted");
      localStorage.setItem("saa_lead_captured", "1");
      setHasLead(true);
      if (typeof window.gtag === "function") {
        window.gtag("event", "generate_lead", { lead_type: "chat_handoff_nadia", page: location.pathname });
      }
    } catch (err) {
      setLeadError("Couldn't send. Call (970) 999-1407 and we'll help right away.");
    } finally {
      setIsTyping(false);
    }
  };

  const handleTransferToAgent = () => {
    setShowTransferOption(false);
    setHandoffStep("collecting");
    setMessages((prev) => [...prev, { role: "assistant", content: "I've got you! Let me grab a few details so Adam or Mandi can jump in and help you directly." }]);
  };

  const handleOpen = () => {
    setIsOpen(true);
    setShowNudge(false);
    if (!hasInteracted) {
      setHasInteracted(true);
      if (typeof window.gtag === "function") window.gtag("event", "chat_opened", { page: location.pathname });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (handoffStep === "collecting") {
        handleHandoffSubmit(e);
      } else {
        handleSubmit(e);
      }
    }
  };

  return (
    // z-[110]: above ListingDetailPanel (z-90) so "Ask Nadia" from the search modal works;
    // nested save/schedule modals sit at z-[120] so lead forms still stack above chat.
    <div ref={chatRef} className="fixed bottom-28 right-4 sm:bottom-8 sm:right-8 z-[110] flex flex-col items-end">
      <style>{`
        @keyframes chatSlideUp { from { opacity: 0; transform: translateY(16px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes chatFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes chatPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes chatPreviewSlide { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes chatTyping { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        @keyframes chatBounceIn { 0% { opacity: 0; transform: translateY(8px) scale(0.96); } 60% { transform: translateY(-2px) scale(1.01); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        .nadia-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .nadia-avatar-sm { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
      `}</style>

      {/* Chat Card */}
      {isOpen && (
        <div
          className="mb-3 w-[360px] sm:w-[400px] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ animation: 'chatSlideUp 0.25s ease-out', maxHeight: 'min(600px, 80vh)' }}
        >
          {/* Header */}
          <div className="bg-black text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <img src={AVATAR_PATH} alt={CHAT_NAME} className="nadia-avatar" />
              <div>
                <p className="font-semibold text-sm">{CHAT_NAME} — {CHAT_TITLE}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  Usually replies in seconds
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl leading-none p-1">&times;</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-[260px] max-h-[400px]">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "items-start gap-2.5"}`}
                style={{ animation: 'chatBounceIn 0.25s ease-out' }}
              >
                {msg.role === "assistant" && (
                  <img src={AVATAR_PATH} alt={CHAT_NAME} className="nadia-avatar-sm mt-1" />
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-black text-white rounded-2xl rounded-br-sm"
                      : "bg-gray-50 text-gray-800 rounded-2xl rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex items-start gap-2.5">
                <img src={AVATAR_PATH} alt={CHAT_NAME} className="nadia-avatar-sm mt-1" />
                <div className="bg-gray-50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'chatTyping 1.2s ease-in-out infinite' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'chatTyping 1.2s ease-in-out infinite 0.2s' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full" style={{ animation: 'chatTyping 1.2s ease-in-out infinite 0.4s' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Live transfer option */}
            {showTransferOption && handoffStep === null && (
              <div className="bg-blue-50 rounded-2xl p-4 text-center" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <p className="text-sm font-semibold text-gray-900 mb-2">Want to talk to Adam or Mandi directly?</p>
                <div className="flex gap-2">
                  <button onClick={handleTransferToAgent} className="flex-1 py-2.5 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors">
                    Yes, connect me 🤝
                  </button>
                  <button onClick={() => setShowTransferOption(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    No, keep chatting
                  </button>
                </div>
              </div>
            )}

            {/* Handoff form */}
            {handoffStep === "collecting" && (
              <div className="bg-blue-50 rounded-2xl p-4" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <p className="text-sm font-semibold text-gray-900 mb-3">Great! How should Adam or Mandi reach you?</p>
                <form onSubmit={handleHandoffSubmit} className="space-y-2">
                  <input required placeholder="Your name *" value={leadInfo.name} onChange={(e) => setLeadInfo({ ...leadInfo, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  <input required type="email" placeholder="your@email.com *" value={leadInfo.email} onChange={(e) => setLeadInfo({ ...leadInfo, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  <input required type="tel" placeholder="Phone *" value={leadInfo.phone} onChange={(e) => setLeadInfo({ ...leadInfo, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black" />
                  
                  {/* Contact preference */}
                  <div className="pt-1">
                    <p className="text-xs font-medium text-gray-500 mb-1.5">Preferred contact method:</p>
                    <div className="flex gap-2">
                      {[
                        { value: "email", label: "📧 Email" },
                        { value: "phone", label: "📞 Phone" },
                        { value: "text", label: "💬 Text" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLeadInfo({ ...leadInfo, contactMethod: opt.value })}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            leadInfo.contactMethod === opt.value
                              ? "bg-black text-white"
                              : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {leadError && <p className="text-red-600 text-xs">{leadError}</p>}
                  <button type="submit" className="w-full py-2.5 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors">
                    Connect Me With Adam & Mandi
                  </button>
                </form>
              </div>
            )}

            {handoffStep === "submitted" && (
              <div className="bg-green-50 rounded-2xl p-4 text-center" style={{ animation: 'chatFadeIn 0.3s ease-out' }}>
                <p className="font-semibold text-gray-900">You're all set, {leadInfo.name.split(" ")[0]}! 🎉</p>
                <p className="text-sm text-gray-600 mt-1">Adam or Mandi will reach out via {leadInfo.contactMethod} shortly.</p>
                <p className="text-xs text-gray-400 mt-1">Need immediate help?</p>
                <a href="tel:(970) 999-1407" className="inline-block mt-2 px-5 py-2.5 bg-black text-white font-semibold rounded-xl text-sm hover:bg-gray-800 transition-colors">
                  Call (970) 999-1407
                </a>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
            {handoffStep === null && !showTransferOption && (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  disabled={isTyping}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-black disabled:opacity-50"
                />
                <button
                  type="submit" disabled={isTyping || !input.trim()}
                  className="px-4 py-2.5 bg-black text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  Send
                </button>
              </form>
            )}
            {handoffStep === "submitted" && (
              <a href="tel:(970) 999-1407" className="block w-full py-2.5 border-2 border-black text-black font-semibold rounded-xl text-sm text-center hover:bg-gray-50 transition-colors">
                Call (970) 999-1407
              </a>
            )}
          </div>
        </div>
      )}

      {/* Teaser bubble — compact, contextual, one per 15 min max */}
      {showNudge && !isOpen && (
        <div
          className="relative mb-2.5 max-w-[230px] sm:max-w-[290px] bg-white rounded-2xl rounded-br-sm shadow-xl border border-gray-100 p-3.5 pr-8"
          style={{ animation: "chatBounceIn 0.25s ease-out" }}
          role="button"
          tabIndex={0}
          onClick={handleOpen}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleOpen(); }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); dismissTeaser(); }}
            aria-label="Dismiss"
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-gray-200 text-gray-500 hover:bg-gray-800 hover:text-white text-[10px] leading-none flex items-center justify-center transition-colors"
          >
            ✕
          </button>
          <p className="text-xs leading-snug text-gray-700">{teaserMessage}</p>
        </div>
      )}

      {/* Chat Bubble */}
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
