import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import AccountModal from "../components/AccountModal";
import { formatPrice } from "../utils/listingHelpers.js";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}/api${path}`, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  let d = null;
  try {
    d = await res.json();
  } catch {
    /* not json */
  }
  if (!res.ok || !d?.success) {
    const err = new Error(d?.error || "Something went wrong.");
    err.status = res.status;
    throw err;
  }
  return d.data;
}

const REACTION_LABEL = { love: "♥ Loves it", maybe: "? Maybe", pass: "✕ Not for me" };

function PersonChip({ p }) {
  const label = p.reaction ? REACTION_LABEL[p.reaction] : p.saved ? "♥ Saved" : "Hasn't weighed in";
  const tone =
    p.reaction === "pass"
      ? "bg-gray-100 text-gray-600"
      : p.reaction || p.saved
        ? "bg-[#CFB36E]/20 text-[#6d5a2c]"
        : "bg-white text-gray-400 border border-dashed border-gray-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span className="text-gray-900">{p.you ? "You" : p.first_name}</span>
      <span aria-hidden="true">·</span>
      {label}
    </span>
  );
}

function CommentBox({ listingKey, onPosted }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const post = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/board/${encodeURIComponent(listingKey)}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      onPosted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={post} className="mt-2 flex gap-2">
      <label htmlFor={`c-${listingKey}`} className="sr-only">Add a comment</label>
      <input
        id={`c-${listingKey}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={1000}
        placeholder="Add a comment for your board"
        className="flex-1 min-w-0 min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm focus:border-[#CFB36E] focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !body.trim()}
        className="min-h-[44px] px-4 rounded-lg bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
      >
        Post
      </button>
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </form>
  );
}

function HomeCard({ home, shared, onChanged }) {
  const href = home.slug ? `/homes-for-sale/${home.slug}/` : null;
  return (
    <article id={`home-${home.listing_key}`} className="rounded-xl border border-gray-200 bg-white overflow-hidden scroll-mt-36">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-56 shrink-0 bg-gray-900 aspect-[4/3] sm:aspect-auto relative">
          {home.photo_url && (
            <img src={`${API_BASE}${home.photo_url}`} alt={home.address || "Home photo"} className="absolute inset-0 w-full h-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          )}
          {home.everyone_loves && (
            <span className="absolute top-2 left-2 rounded-full bg-[#CFB36E] text-gray-900 text-[11px] font-bold px-2.5 py-1 shadow">
              Everyone loves it
            </span>
          )}
        </div>
        <div className="p-4 flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xl font-bold text-gray-900">{formatPrice(home.list_price)}</p>
            {home.off_market && <span className="text-xs font-semibold text-gray-500">{home.status}</span>}
          </div>
          {href ? (
            <Link to={href} className="block mt-0.5 text-sm text-gray-700 hover:underline truncate">{home.address}</Link>
          ) : (
            <p className="mt-0.5 text-sm text-gray-700 truncate">{home.address}</p>
          )}
          {(home.beds != null || home.living_area != null) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[home.beds != null && `${home.beds} bd`, home.baths != null && `${home.baths} ba`, home.living_area && `${Number(home.living_area).toLocaleString()} sqft`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {home.people.map((p) => <PersonChip key={p.user_id} p={p} />)}
          </div>
          {shared && (
            <div className="mt-3 border-t border-gray-100 pt-3">
              {home.comments.length > 0 && (
                <ul className="space-y-1.5 mb-1">
                  {home.comments.map((c) => (
                    <li key={c.id} className="text-sm text-gray-800">
                      <span className="font-semibold">{c.mine ? "You" : c.author}:</span> {c.body}
                    </li>
                  ))}
                </ul>
              )}
              <CommentBox listingKey={home.listing_key} onPosted={onChanged} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function InviteForm({ onInvited }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/household/invite", { method: "POST", body: JSON.stringify({ email, name }) });
      setMsg({ ok: true, text: `Invite sent to ${email}.` });
      setEmail("");
      setName("");
      onInvited();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="sr-only" htmlFor="invite-name">Their name</label>
      <input
        id="invite-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Their name"
        className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
      />
      <label className="sr-only" htmlFor="invite-email">Their email</label>
      <input
        id="invite-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Their email"
        className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-sm"
      />
      <button type="submit" disabled={busy} className="min-h-[44px] px-5 rounded-lg bg-[#CFB36E] text-gray-900 text-sm font-bold disabled:opacity-60">
        Send invite
      </button>
      {msg && (
        <p className={`sm:col-span-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`} role="status">{msg.text}</p>
      )}
    </form>
  );
}

/**
 * Shared board: every co-buyer's saved homes, how each person feels about
 * them, and a comment thread per home. /board/?join=<token> accepts an invite.
 */
export default function BoardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, setState] = useState({ loading: true });
  const [joinMsg, setJoinMsg] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [household, board] = await Promise.all([api("/household"), api("/board")]);
      setState({ loading: false, household, board });
    } catch (err) {
      setState({ loading: false, signedOut: err.status === 401, error: err.status === 401 ? null : err.message });
    }
  }, []);

  useEffect(() => {
    const token = searchParams.get("join");
    (async () => {
      if (token) {
        try {
          await api("/household/join", { method: "POST", body: JSON.stringify({ token }) });
          setJoinMsg({ ok: true, text: "You're on the board. Everything you save shows up here for both of you." });
          window.dispatchEvent(new CustomEvent("saa-saved-homes-changed", { detail: { signedIn: true } }));
        } catch (err) {
          setJoinMsg({ ok: false, text: err.message });
        }
        const next = new URLSearchParams(searchParams);
        next.delete("join");
        setSearchParams(next, { replace: true });
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per arrival
  }, []);

  // A co-buyer may have commented while this tab sat in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  // Notification links land on #home-<key>; scroll once the board renders.
  useEffect(() => {
    if (!state.board || !window.location.hash) return;
    document.getElementById(decodeURIComponent(window.location.hash.slice(1)))?.scrollIntoView({ block: "start" });
  }, [state.board]);

  const cancelInvite = async (id) => {
    await api(`/household/invites/${id}`, { method: "DELETE" }).catch(() => {});
    load();
  };
  const leave = async () => {
    if (!window.confirm("Leave this shared board? Your own saved homes stay with you.")) return;
    await api("/household/leave", { method: "POST", body: "{}" }).catch(() => {});
    load();
  };

  const others = state.household?.members?.filter((m) => !m.you) || [];
  const shared = Boolean(state.board?.shared);

  return (
    <div className="min-h-screen bg-gray-50 pt-[var(--saa-header-h,5rem)] pb-16">
      <SEO
        title="Our Board | SAA Homes"
        description="Shop for a home together: shared saved homes, reactions and comments."
        canonical="https://saahomes.com/board/"
        robots="noindex, nofollow"
      />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
          {shared ? "Our board" : "Shop together"}
        </h1>
        {shared ? (
          <p className="text-sm text-gray-600 mt-1">
            You and {others.map((m) => m.first_name).join(", ")} see the same homes, each other&apos;s reactions and comments. Private notes stay private.
          </p>
        ) : (
          <p className="text-sm text-gray-600 mt-1">
            Buying with someone? Invite them and you&apos;ll both see every home either of you saves, who loves what, and a comment thread on each one.
          </p>
        )}

        {joinMsg && (
          <p className={`mt-4 rounded-lg px-4 py-3 text-sm ${joinMsg.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`} role="status">
            {joinMsg.text}
          </p>
        )}

        {state.loading && <p className="mt-8 text-sm text-gray-500">Loading your board…</p>}
        {state.error && <p className="mt-8 text-sm text-red-700">{state.error}</p>}

        {state.signedOut && (
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
            <p className="text-gray-800">Sign in to see your board and invite the person you&apos;re shopping with.</p>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="mt-4 min-h-[44px] px-5 rounded-lg bg-gray-900 text-white text-sm font-semibold"
            >
              Sign in
            </button>
          </div>
        )}

        {state.board && (
          <>
            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-bold text-gray-900">{shared ? "Invite someone else" : "Invite your co-buyer"}</h2>
              <div className="mt-3">
                <InviteForm onInvited={load} />
              </div>
              {state.household?.invites?.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {state.household.invites.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-3 text-sm text-gray-600">
                      <span>Waiting on {i.name ? `${i.name} (${i.email})` : i.email}</span>
                      <button type="button" onClick={() => cancelInvite(i.id)} className="text-xs font-semibold text-gray-500 underline min-h-[32px]">
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-6 space-y-4" aria-label="Homes on the board">
              {state.board.homes.length === 0 ? (
                <p className="text-sm text-gray-600">
                  Nothing saved yet. <Link to="/properties/" className="font-semibold text-[#8a7340] underline">Start a search</Link> and tap the heart on homes you like.
                </p>
              ) : (
                state.board.homes.map((h) => <HomeCard key={h.listing_key} home={h} shared={shared} onChanged={load} />)
              )}
            </section>

            {shared && (
              <button type="button" onClick={leave} className="mt-8 text-xs text-gray-500 underline min-h-[32px]">
                Leave this board
              </button>
            )}
          </>
        )}
      </div>
      <AccountModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={() => {
          setLoginOpen(false);
          load();
        }}
        purpose="sign-in"
        showSuccess={false}
      />
    </div>
  );
}
