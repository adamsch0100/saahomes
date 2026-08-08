import React, { useMemo, useState } from "react";

const GOLD = "#CFB36E";
const GOLD_SOFT = "rgba(207, 179, 110, 0.22)";
const INK = "#111111";
const MUTED = "#6b7280";

function fmtK(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const v = Number(n);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 10_000) return `$${Math.round(v / 1000)}K`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtFull(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function yearLabel(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr).slice(0, 4);
  return String(d.getUTCFullYear());
}

/**
 * Branded 10-year home-value chart (custom SVG — not a bare chart-lib embed).
 *
 * Design:
 *  - Gold primary series (#CFB36E) with soft fill under the curve
 *  - Optional comparison series (neighborhood/city) as muted dashed line
 *  - Our-comps range band overlay (horizontal gold-tint band at current mid ±)
 *  - Market AVM markers on the right rail when present
 *  - Hover tooltip with full dollar amount + date
 *  - Mobile-first, accessible labels, source attribution footer
 */
export default function HomeValueChart({
  chart = null,
  ourRange = null, // { low, mid, high }
  market = null, // { mid, providers[] }
  height = 280,
  className = "",
}) {
  const [hover, setHover] = useState(null);

  const model = useMemo(() => {
    const points = chart?.home?.points || [];
    if (!points.length) return null;

    const W = 640;
    const H = height;
    const pad = { t: 28, r: 16, b: 36, l: 52 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;

    const xs = points.map((p) => p.date_ms ?? Date.parse(p.date));
    const ys = points.map((p) => p.value);
    let yMin = Math.min(...ys);
    let yMax = Math.max(...ys);

    // Expand domain to include our range + market mid so overlays fit
    if (ourRange?.low != null) yMin = Math.min(yMin, ourRange.low);
    if (ourRange?.high != null) yMax = Math.max(yMax, ourRange.high);
    if (market?.mid != null) {
      yMin = Math.min(yMin, market.mid);
      yMax = Math.max(yMax, market.mid);
    }
    if (market?.providers?.length) {
      for (const p of market.providers) {
        if (p.value != null) {
          yMin = Math.min(yMin, p.value);
          yMax = Math.max(yMax, p.value);
        }
      }
    }

    // Pad 8%
    const span = Math.max(yMax - yMin, 1000);
    yMin = Math.max(0, yMin - span * 0.08);
    yMax = yMax + span * 0.08;

    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const xSpan = Math.max(xMax - xMin, 1);

    const xOf = (ms) => pad.l + ((ms - xMin) / xSpan) * innerW;
    const yOf = (v) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * innerH;

    const linePath = points
      .map((p, i) => {
        const x = xOf(p.date_ms ?? Date.parse(p.date));
        const y = yOf(p.value);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

    const areaPath =
      linePath +
      ` L${xOf(xs[xs.length - 1]).toFixed(1)},${(pad.t + innerH).toFixed(1)}` +
      ` L${xOf(xs[0]).toFixed(1)},${(pad.t + innerH).toFixed(1)} Z`;

    // Comparison series (first extra only for clarity)
    const comp = chart?.series?.[0];
    let compPath = null;
    if (comp?.points?.length) {
      const cps = comp.points.filter(
        (p) => (p.date_ms ?? Date.parse(p.date)) >= xMin && (p.date_ms ?? Date.parse(p.date)) <= xMax
      );
      if (cps.length > 1) {
        compPath = cps
          .map((p, i) => {
            const x = xOf(p.date_ms ?? Date.parse(p.date));
            const y = yOf(p.value);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ");
      }
    }

    // Year ticks (≈ 5 labels)
    const yearSet = [];
    const seen = new Set();
    for (const p of points) {
      const y = yearLabel(p.date);
      if (y && !seen.has(y)) {
        seen.add(y);
        yearSet.push({ year: y, ms: p.date_ms ?? Date.parse(p.date) });
      }
    }
    const tickYears =
      yearSet.length <= 6
        ? yearSet
        : yearSet.filter((_, i) => i === 0 || i === yearSet.length - 1 || i % Math.ceil(yearSet.length / 5) === 0);

    // Y ticks
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const v = yMin + (yMax - yMin) * (1 - t); // top to bottom later
      return { t, value: yMin + (yMax - yMin) * t };
    });

    const latest = points[points.length - 1];
    const earliest = points[0];
    const change =
      latest && earliest && earliest.value
        ? Math.round(((latest.value - earliest.value) / earliest.value) * 100)
        : null;

    return {
      W,
      H,
      pad,
      innerW,
      innerH,
      linePath,
      areaPath,
      compPath,
      compName: comp?.name || "Area trend",
      xOf,
      yOf,
      yMin,
      yMax,
      tickYears,
      yTicks,
      points,
      latest,
      earliest,
      change,
    };
  }, [chart, ourRange, market, height]);

  if (!model) {
    return (
      <div
        className={`rounded-2xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white p-6 ${className}`}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#CFB36E]">
              10-year value history
            </p>
            <h3 className="text-lg font-bold text-gray-900 mt-0.5">Chart unavailable</h3>
          </div>
        </div>
        <p className="text-sm text-gray-500 leading-relaxed">
          We&apos;ll show licensed market history when it&apos;s available for this address.
          Your estimate below still uses our live MLS sales data.
        </p>
        {ourRange?.mid != null && (
          <div className="mt-5 rounded-xl bg-black text-white px-4 py-3 flex items-baseline justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#CFB36E]">
              Our estimate
            </span>
            <span className="text-xl font-bold">{fmtFull(ourRange.mid)}</span>
          </div>
        )}
      </div>
    );
  }

  const {
    W,
    H,
    pad,
    linePath,
    areaPath,
    compPath,
    compName,
    xOf,
    yOf,
    tickYears,
    yTicks,
    points,
    latest,
    change,
    yMin,
    yMax,
  } = model;

  const ourBand =
    ourRange?.low != null && ourRange?.high != null
      ? {
          y1: yOf(ourRange.high),
          y2: yOf(ourRange.low),
          midY: ourRange.mid != null ? yOf(ourRange.mid) : null,
        }
      : null;

  const onMove = (evt) => {
    const svg = evt.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((evt.clientX - rect.left) / rect.width) * W;
    // Find nearest point
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const x = xOf(p.date_ms ?? Date.parse(p.date));
      const d = Math.abs(x - px);
      if (d < bestDist) {
        bestDist = d;
        best = { ...p, x, y: yOf(p.value), i };
      }
    }
    if (best && bestDist < 40) setHover(best);
    else setHover(null);
  };

  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm ${className}`}
    >
      <div className="px-4 sm:px-5 pt-4 sm:pt-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#CFB36E]">
            10-year value history
          </p>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
            <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {fmtFull(latest?.value ?? chart?.home?.latest_value)}
            </h3>
            {change != null && (
              <span
                className={`text-sm font-semibold ${
                  change >= 0 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {change >= 0 ? "+" : ""}
                {change}% over 10 years
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Licensed market history · not an appraisal
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black text-white font-semibold">
            <span className="w-2 h-2 rounded-full" style={{ background: GOLD }} />
            This home
          </span>
          {compPath && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
              <span className="w-3 border-t-2 border-dashed border-gray-400" />
              {compName}
            </span>
          )}
          {ourRange?.mid != null && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#CFB36E]/60 text-gray-800 font-medium">
              <span className="w-2 h-2 rounded-sm bg-[#CFB36E]/40 border border-[#CFB36E]" />
              Our comps range
            </span>
          )}
        </div>
      </div>

      <div className="relative px-1 sm:px-2 pb-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto select-none"
          role="img"
          aria-label="Home value over the past ten years"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => {
            const t = e.touches[0];
            if (!t) return;
            onMove({
              currentTarget: e.currentTarget,
              clientX: t.clientX,
              clientY: t.clientY,
            });
          }}
        >
          <defs>
            <linearGradient id="saaHomeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0.35" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0.02" />
            </linearGradient>
            <filter id="saaGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid */}
          {yTicks.map((tick) => {
            const y = yOf(tick.value);
            return (
              <g key={tick.value}>
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={y}
                  y2={y}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
                <text
                  x={pad.l - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill={MUTED}
                  fontSize="10"
                  fontFamily="system-ui, sans-serif"
                >
                  {fmtK(tick.value)}
                </text>
              </g>
            );
          })}

          {/* Our comps range band */}
          {ourBand && (
            <g>
              <rect
                x={pad.l}
                y={ourBand.y1}
                width={W - pad.l - pad.r}
                height={Math.max(2, ourBand.y2 - ourBand.y1)}
                fill={GOLD_SOFT}
                rx="2"
              />
              {ourBand.midY != null && (
                <line
                  x1={pad.l}
                  x2={W - pad.r}
                  y1={ourBand.midY}
                  y2={ourBand.midY}
                  stroke={GOLD}
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  opacity="0.9"
                />
              )}
            </g>
          )}

          {/* Comparison series */}
          {compPath && (
            <path
              d={compPath}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.75"
              strokeDasharray="5 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Primary area + line */}
          <path d={areaPath} fill="url(#saaHomeFill)" />
          <path
            d={linePath}
            fill="none"
            stroke={GOLD}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#saaGlow)"
          />

          {/* Latest point */}
          {latest && (
            <circle
              cx={xOf(latest.date_ms ?? Date.parse(latest.date))}
              cy={yOf(latest.value)}
              r="5"
              fill={INK}
              stroke={GOLD}
              strokeWidth="2.5"
            />
          )}

          {/* Market mid marker (right edge) */}
          {market?.mid != null && market.mid >= yMin && market.mid <= yMax && (
            <g>
              <circle
                cx={W - pad.r}
                cy={yOf(market.mid)}
                r="4"
                fill="#2563eb"
                stroke="#fff"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* X labels */}
          {tickYears.map((t) => (
            <text
              key={t.year}
              x={xOf(t.ms)}
              y={H - 12}
              textAnchor="middle"
              fill={MUTED}
              fontSize="10"
              fontFamily="system-ui, sans-serif"
            >
              {t.year}
            </text>
          ))}

          {/* Hover crosshair + dot */}
          {hover && (
            <g>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={pad.t}
                y2={H - pad.b}
                stroke="#d1d5db"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={hover.x} cy={hover.y} r="5.5" fill={GOLD} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (
          <div
            className="pointer-events-none absolute z-10 rounded-lg bg-black text-white text-xs px-3 py-2 shadow-lg"
            style={{
              left: `clamp(8px, ${(hover.x / W) * 100}%, calc(100% - 140px))`,
              top: 48,
              minWidth: 120,
            }}
          >
            <div className="text-[#CFB36E] font-semibold">{hover.date}</div>
            <div className="text-sm font-bold mt-0.5">{fmtFull(hover.value)}</div>
          </div>
        )}
      </div>

      {/* Provider compare strip */}
      {(ourRange?.mid != null || market?.mid != null || market?.providers?.length) && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ourRange?.mid != null && (
            <div className="rounded-xl border border-[#CFB36E]/50 bg-[#CFB36E]/10 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                Our MLS data
              </p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{fmtFull(ourRange.mid)}</p>
              {ourRange.low != null && ourRange.high != null && (
                <p className="text-[11px] text-gray-500">
                  {fmtFull(ourRange.low)} – {fmtFull(ourRange.high)}
                </p>
              )}
            </div>
          )}
          {market?.mid != null && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-800/80">
                Market services
              </p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{fmtFull(market.mid)}</p>
              <p className="text-[11px] text-gray-500">
                {market.source || "Licensed AVMs"}
              </p>
            </div>
          )}
          {market?.providers?.slice(0, 1).map((p) => (
            <div
              key={p.name}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {p.name}
              </p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{fmtFull(p.value)}</p>
              {(p.low != null || p.high != null) && (
                <p className="text-[11px] text-gray-500">
                  {fmtFull(p.low)} – {fmtFull(p.high)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 sm:px-5 pb-4 text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
        {chart?.attribution ||
          "Historical values via licensed market data when available. SAA range uses live MLS sales data. Estimates only — not an appraisal."}
        {chart?.cached ? " · Cached for speed & cost control." : null}
      </div>
    </div>
  );
}
