import React, { useState } from "react";
import { citationText, citationHtml } from "../utils/citation.js";

// "Cite this" box with copy buttons for the plain line, an HTML link snippet,
// and a direct link to this stat. Shared by the /resources/ stat pages.
export default function CiteBlock({ cite, url, pageTitle, className = "" }) {
  const [copied, setCopied] = useState("");
  const text = citationText(cite, url);
  const html = citationHtml(cite, url, pageTitle);

  const copy = async (key, value) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const el = document.createElement("textarea");
      el.value = value;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  };

  const button = (key, label, value) => (
    <button
      type="button"
      onClick={() => copy(key, value)}
      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-gray-300 bg-white hover:border-black transition-colors"
    >
      {copied === key ? "Copied" : label}
    </button>
  );

  return (
    <div className={`bg-gray-50 border border-gray-100 rounded-lg p-4 ${className}`}>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        Cite this
      </p>
      <p className="text-sm text-gray-700 italic mb-3">{text}</p>
      <div className="flex flex-wrap gap-2">
        {button("text", "Copy citation", text)}
        {button("html", "Copy HTML with link", html)}
        {button("link", "Copy link to this stat", url)}
      </div>
    </div>
  );
}
