/**
 * Brand colors for the site.
 *
 * The CSS custom properties in src/index.css (:root) hold SAA's palette and are
 * what Tailwind classes read (`bg-[color:var(--brand-accent)]`, …). On another
 * brokerage's domain TenantProvider calls applyBrandTheme(brand) which writes the
 * brokerage's colors onto <html>, so every class follows without a rebuild.
 *
 * SAA_THEME mirrors the CSS defaults for the few places CSS variables can't
 * reach (Mapbox paint properties, SVG data URIs, SVG presentation attributes,
 * HTML snippets agents paste on other sites). Read them through getBrandTheme().
 */

export const SAA_THEME = Object.freeze({
  accent: '#CFB36E',
  accentHover: '#c0a55e',
  accentStrong: '#bd9f5a',
  accentDeep: '#b89a55',
  accentText: '#8a7340',
  onAccent: '#000000',
  onAccentInk: '#1a1a1a',
  primary: '#111111',
});

// A brokerage that hasn't picked colors gets a neutral palette, never SAA's gold.
const NEUTRAL_PRIMARY = '#111111';
const NEUTRAL_ACCENT = '#374151';

let current = { ...SAA_THEME };

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  if (!v.startsWith('#')) v = `#${v}`;
  if (/^#[0-9a-f]{3}$/.test(v)) v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

function toRgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbChannels(hex) {
  const rgb = toRgb(hex);
  return rgb ? rgb.join(' ') : null;
}

/** Mix a color toward black by `amount` (0–1). */
export function darken(hex, amount = 0.08) {
  const rgb = toRgb(hex);
  if (!rgb) return hex;
  return `#${rgb
    .map((c) => Math.max(0, Math.round(c * (1 - amount))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/** Black or white, whichever reads better on `hex`. */
export function readableOn(hex) {
  const rgb = toRgb(hex);
  if (!rgb) return '#000000';
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.4 ? '#000000' : '#ffffff';
}

/** Theme for a brokerage brand ({ accentColor, primaryColor }); never SAA's colors. */
export function themeFromBrand(brand) {
  const primary = normalizeHex(brand?.primaryColor) || NEUTRAL_PRIMARY;
  const accent = normalizeHex(brand?.accentColor) || normalizeHex(brand?.primaryColor) || NEUTRAL_ACCENT;
  const on = readableOn(accent);
  return {
    accent,
    accentHover: darken(accent, 0.07),
    accentStrong: darken(accent, 0.09),
    accentDeep: darken(accent, 0.11),
    // Accent-colored text on white: a light accent is darkened to stay legible.
    accentText: on === '#000000' ? darken(accent, 0.33) : accent,
    onAccent: on,
    onAccentInk: on === '#000000' ? '#1a1a1a' : '#ffffff',
    primary,
  };
}

/** The palette in effect (SAA's unless a brokerage brand was applied). */
export function getBrandTheme() {
  return current;
}

/** Write a brokerage's palette onto <html> and the theme-color meta. */
export function applyBrandTheme(theme) {
  current = { ...SAA_THEME, ...theme };
  if (typeof document === 'undefined') return;
  const s = document.documentElement.style;
  s.setProperty('--brand-accent', current.accent);
  s.setProperty('--brand-accent-rgb', rgbChannels(current.accent) || '0 0 0');
  s.setProperty('--brand-accent-hover', current.accentHover);
  s.setProperty('--brand-accent-strong', current.accentStrong);
  s.setProperty('--brand-accent-deep', current.accentDeep);
  s.setProperty('--brand-accent-text', current.accentText);
  s.setProperty('--brand-on-accent', current.onAccent);
  s.setProperty('--brand-on-accent-ink', current.onAccentInk);
  s.setProperty('--brand-primary', current.primary);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', current.primary);
}
