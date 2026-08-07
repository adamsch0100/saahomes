import React, { useEffect, useState } from "react";

/**
 * On-site virtual tour viewer.
 * Matterport / common 3D hosts embed cleanly in an iframe; others get an
 * external-link fallback so we never strand the user on a blank frame.
 * URL must come only from listing data (feats.virtual_tour) — never fabricated.
 */

/** Hosts known to allow iframe embeds for virtual tours / 3D walkthroughs. */
const EMBED_HOST_HINTS = [
  "matterport.com",
  "my.matterport.com",
  "kuula.co",
  "kuula.com",
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
  "tourmkr.com",
  "cloudpano.com",
  "immoviewer.com",
  "giraffe360.com",
  "iplayerhd.com",
  "lcp360.com",
  "tourinary.com",
  "3dtours.com",
  "ricoh360.com",
  "ths.li",
  "listinglab.com",
  "homejab.com",
  "cubicasa.com",
  "panoskin.com",
  "roundme.com",
  "eyeseeyou.com",
  "tourpano.com",
];

/** Hosts that almost always block framing (X-Frame-Options / CSP). */
const BLOCK_HOST_HINTS = [
  "zillow.com",
  "realtor.com",
  "redfin.com",
  "homes.com",
  "trulia.com",
  "facebook.com",
  "fb.com",
  "instagram.com",
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * @returns {"embed"|"external"}
 */
export function tourEmbedMode(url) {
  if (!url || typeof url !== "string") return "external";
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "external";
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "external";
  const host = hostOf(url);
  if (!host) return "external";
  if (BLOCK_HOST_HINTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return "external";
  }
  if (EMBED_HOST_HINTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return "embed";
  }
  // Unknown HTTPS host: attempt embed (many boutique 3D hosts work); UI always
  // offers "Open in new tab" if the frame is blank/blocked.
  if (parsed.protocol === "https:") return "embed";
  return "external";
}

/** Normalize Matterport share links into a clean show URL when needed. */
function embedSrc(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // youtu.be / youtube watch → embed
    if (host.includes("youtu.be")) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
    }
    if (host.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube-nocookie.com/embed/${u.searchParams.get("v")}?rel=0`;
    }
    if (host.includes("vimeo.com") && !host.includes("player.")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    return url;
  } catch {
    return url;
  }
}

/**
 * Full-screen (or near full) modal with iframe tour + external fallback.
 */
export default function VirtualTourModal({ url, open, onClose, title = "Virtual tour" }) {
  const [frameFailed, setFrameFailed] = useState(false);
  const mode = tourEmbedMode(url);
  const src = mode === "embed" ? embedSrc(url) : null;

  useEffect(() => {
    if (!open) return undefined;
    setFrameFailed(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !url) return null;

  const showIframe = mode === "embed" && src && !frameFailed;

  return (
    <div
      className="fixed inset-0 z-[115] flex flex-col bg-black/90"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop click closes when not interacting with frame */}
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close virtual tour"
        onClick={onClose}
      />

      <div className="relative z-10 flex flex-col h-full max-h-[100dvh] w-full max-w-6xl mx-auto sm:my-3 sm:rounded-2xl overflow-hidden bg-black shadow-2xl sm:h-[calc(100dvh-1.5rem)]">
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-black border-b border-white/10">
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{title}</p>
            <p className="text-[11px] text-gray-400 truncate">Stay on SAA Homes · tour loads in-page</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-lg border border-white/30 text-white text-xs font-semibold hover:bg-white/10"
            >
              Open in new tab
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white text-2xl leading-none touch-manipulation"
              aria-label="Close virtual tour"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative bg-neutral-900">
          {showIframe ? (
            <iframe
              title={title}
              src={src}
              className="absolute inset-0 w-full h-full border-0 bg-black"
              allow="fullscreen; xr-spatial-tracking; accelerometer; gyroscope; autoplay"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              onError={() => setFrameFailed(true)}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#CFB36E]/20 flex items-center justify-center mb-4">
                <span className="text-[#CFB36E] text-2xl" aria-hidden="true">
                  ⧉
                </span>
              </div>
              <h3 className="text-lg font-bold text-white font-serif">Open this virtual tour</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-md leading-relaxed">
                This tour provider doesn&apos;t allow embedding on our site. We&apos;ll open it in a
                new tab so you can still walk through the home.
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center px-6 py-3 rounded-lg font-semibold text-sm active:scale-[0.98] transition-transform"
                style={{ backgroundColor: "#CFB36E", color: "#1a1a1a" }}
              >
                Open virtual tour
              </a>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 text-sm text-gray-400 hover:text-white underline underline-offset-2"
              >
                Stay on this listing
              </button>
            </div>
          )}
        </div>

        {/* Mobile: always offer external escape hatch under the frame */}
        {showIframe && (
          <div className="sm:hidden shrink-0 px-3 py-2.5 border-t border-white/10 bg-black flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400">Tour not loading?</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-[#CFB36E] underline underline-offset-2"
            >
              Open in new tab
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Button that opens the on-site tour modal (or external fallback if URL missing).
 */
export function VirtualTourButton({
  url,
  label = "Virtual Tour",
  className = "",
  style,
}) {
  const [open, setOpen] = useState(false);
  if (!url) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        style={style}
      >
        {label}
      </button>
      <VirtualTourModal url={url} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
