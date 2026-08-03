import React from "react";

const GOLD = "#CFB36E";

/**
 * QualifyCta — conversational lead-capture band for lending/program pages.
 *
 * Primary action opens Nadia chat pre-seeded with a "do I qualify?" question
 * for the specific program. Secondary action jumps to the page's lead form.
 * Designed to convert browsing visitors into a conversation (→ handoff form).
 */
export default function QualifyCta({
  program = "this program",
  chatQuestion,
  formAnchor = "#lead-form",
  formLabel = "Skip to the form",
  headline = "Not sure if you qualify?",
  subtext = "It's a quick conversation — tell us a little about your situation and we'll walk you through your options. No pressure, no obligation.",
}) {
  const openChat = () => {
    const question =
      chatQuestion ||
      `Hi! I'd like to know if I qualify for ${program}. Can you walk me through the requirements and what comes next?`;
    window.dispatchEvent(new CustomEvent("open-nadia-chat", { detail: { message: question } }));
  };

  return (
    <section className="bg-black text-white py-12 sm:py-14 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-bold font-serif leading-tight">{headline}</h2>
        <p className="mt-3 text-gray-300 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">{subtext}</p>
        <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center">
          <button
            type="button"
            onClick={openChat}
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 font-semibold rounded-lg hover:opacity-90 transition-opacity touch-manipulation shadow-lg cursor-pointer"
            style={{ backgroundColor: GOLD, color: "#1a1a1a" }}
          >
            💬 Chat about qualifying
          </button>
          <a
            href={formAnchor}
            className="inline-flex items-center justify-center px-8 py-3.5 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-black transition-colors touch-manipulation"
          >
            {formLabel}
          </a>
        </div>
        <p className="mt-4 text-xs text-gray-500">
          Chat is answered instantly by Nadia, our AI assistant — or call{" "}
          <a href="tel:+19709991407" className="underline hover:text-gray-300">
            (970) 999-1407
          </a>
          .
        </p>
      </div>
    </section>
  );
}
