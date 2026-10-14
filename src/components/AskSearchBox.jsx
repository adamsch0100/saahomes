import React, { useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const EXAMPLES = ["3 beds under $550K", "Ranch with a 3 car garage", "Walkout basement on half an acre"];

async function understand(body) {
  const res = await fetch(`${API_BASE}/api/search/understand`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const d = await res.json().catch(() => null);
  if (!res.ok || !d?.success) throw new Error(d?.error || "Something went wrong. Try the full search.");
  return d.data;
}

/**
 * "Describe the home you want": turns plain words into search filters the
 * buyer can see and remove, with a live count, then opens the full search.
 * `city` is the town of the page it sits on, used when the buyer names none.
 */
export default function AskSearchBox({ city, tone = "dark" }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [notes, setNotes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (body) => {
    setBusy(true);
    setError(null);
    try {
      const data = await understand(body);
      setResult(data);
      if (body.text) setNotes(data.unsupported);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e, value = text) => {
    e?.preventDefault();
    const t = value.trim();
    if (t.length < 3) return;
    run({ text: t, city });
  };

  const remove = (chip) => {
    const filters = { ...result.filters };
    chip.keys.forEach((k) => delete filters[k]);
    run({ filters: Object.keys(filters).length ? filters : city ? { city } : {} });
  };

  const light = tone === "light";
  return (
    <div className={`w-full max-w-2xl mx-auto text-left ${light ? "text-gray-900" : "text-white"}`}>
      <form onSubmit={submit} className="flex gap-2 bg-white rounded-xl p-1.5 shadow-lg">
        <label htmlFor="ask-search" className="sr-only">Describe the home you want</label>
        <input
          id="ask-search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={`Try: 3 beds under $550K with a 3 car garage${city ? ` in ${city}` : ""}`}
          className="flex-1 min-w-0 min-h-[44px] px-3 text-base text-gray-900 placeholder-gray-400 bg-transparent outline-none"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 min-h-[44px] px-4 sm:px-5 rounded-lg bg-[color:var(--brand-accent)] text-[color:var(--brand-on-accent)] font-semibold hover:bg-[color:var(--brand-accent-strong)] disabled:opacity-60"
        >
          {busy && !result ? "Searching…" : "Search"}
        </button>
      </form>

      {!result && !error && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => { setText(ex); submit(null, ex); }}
              className={`min-h-[36px] px-3 rounded-full text-sm border ${light ? "border-gray-300 text-gray-700 hover:border-gray-900" : "border-white/40 text-white/90 hover:bg-white/10"}`}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {error && <p className={`mt-3 text-sm ${light ? "text-red-700" : "text-red-200"}`} role="alert">{error}</p>}

      {result && (
        <div className="mt-3 rounded-xl bg-white text-gray-900 p-4 shadow-lg" aria-live="polite">
          {result.understood ? (
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Here&apos;s what we searched for</p>
          ) : (
            <p className="text-sm text-gray-700">
              We couldn&apos;t turn that into filters. Try a price, bedrooms, a garage size or a lot size.
            </p>
          )}
          {result.chips.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {result.chips.map((c) => (
                <li key={c.keys.join("+")}>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    aria-label={`Remove ${c.label}`}
                    className="inline-flex items-center gap-1.5 min-h-[36px] pl-3 pr-2 rounded-full bg-gray-100 text-sm font-medium hover:bg-gray-200"
                  >
                    {c.label}
                    <span aria-hidden="true" className="text-gray-400 text-base leading-none">×</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {notes.length > 0 && (
            <ul className="mt-3 space-y-1">
              {notes.map((u) => (
                <li key={u.topic} className="text-xs text-gray-500">{u.note}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={result.path}
              className="inline-flex items-center min-h-[44px] px-5 rounded-lg bg-gray-900 text-white text-sm font-bold hover:bg-black"
            >
              {result.count === 0
                ? "Open the search to widen it"
                : `See ${result.count.toLocaleString()} home${result.count === 1 ? "" : "s"}`}
            </a>
            {result.count === 0 && (
              <span className="text-sm text-gray-600">Nothing matches right now. Remove a chip to see more.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
