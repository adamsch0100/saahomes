import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/**
 * Typed city/ZIP multi-select combobox for ListingSearch.
 * - Type-ahead over live /api/listings/locations counts (never hardcoded)
 * - Multi city + multi zip as removable chips
 * - Quick-pick chips for the 19 NoCO cities
 * - Default scope remains Northern Colorado (__noco__)
 */

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

export const NOCO_CITY_LIST = [
  "Fort Collins", "Loveland", "Windsor", "Greeley", "Timnath", "Severance",
  "Wellington", "Johnstown", "Longmont", "Boulder", "Berthoud", "Firestone",
  "Frederick", "Evans", "Mead", "Milliken", "La Salle", "Eaton", "Niwot",
];

export function parseCityList(city) {
  if (!city || city === "__noco__" || city === "__all__") return [];
  return String(city)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseZipList(postal) {
  if (!postal) return [];
  return String(postal)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function joinCities(list) {
  if (!list.length) return "__noco__";
  return list.join(",");
}

function joinZips(list) {
  return list.join(",");
}

function formatCount(n) {
  if (n == null) return "";
  return Number(n).toLocaleString();
}

/**
 * @param {object} props
 * @param {string} props.city - __noco__ | __all__ | "Denver" | "Denver,Erie"
 * @param {string} props.postalCode - "" | "80521" | "80521,80525"
 * @param {(patch: { city?: string, postalCode?: string }) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.showQuickPicks] - NoCO chips under the input
 * @param {string} [props.className]
 * @param {string} [props.inputClassName]
 * @param {string} [props.id]
 */
export default function LocationCombobox({
  city = "__noco__",
  postalCode = "",
  onChange,
  disabled = false,
  showQuickPicks = true,
  className = "",
  inputClassName = "",
  id = "location-combobox",
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({ specials: [], cities: [], zips: [] });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  const cities = useMemo(() => parseCityList(city), [city]);
  const zips = useMemo(() => parseZipList(postalCode), [postalCode]);

  const scopeLabel = (() => {
    if (cities.length || zips.length) return null;
    if (city === "__all__") return "All Colorado";
    return "Northern Colorado";
  })();

  const fetchSuggestions = useCallback(async (q) => {
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      params.set("limit", "12");
      const res = await fetch(`${API_BASE}/api/listings/locations?${params}`, {
        signal: ac.signal,
      });
      if (!res.ok) throw new Error("autocomplete failed");
      const json = await res.json();
      if (ac.signal.aborted) return;
      setResults({
        specials: json.data?.specials || [],
        cities: json.data?.cities || [],
        zips: json.data?.zips || [],
      });
    } catch (err) {
      if (err?.name === "AbortError") return;
      setResults({ specials: [], cities: [], zips: [] });
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query.trim());
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, fetchSuggestions]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const emit = (nextCities, nextZips, scope) => {
    if (scope === "__noco__") {
      onChange({ city: "__noco__", postalCode: "" });
      return;
    }
    if (scope === "__all__") {
      onChange({ city: "__all__", postalCode: nextZips.length ? joinZips(nextZips) : "" });
      return;
    }
    if (!nextCities.length && !nextZips.length) {
      onChange({ city: "__noco__", postalCode: "" });
      return;
    }
    if (!nextCities.length && nextZips.length) {
      // Zip-only → statewide scope so NoCO city list doesn't AND-filter zips
      onChange({ city: "__all__", postalCode: joinZips(nextZips) });
      return;
    }
    onChange({
      city: joinCities(nextCities),
      postalCode: nextZips.length ? joinZips(nextZips) : "",
    });
  };

  const selectScope = (value) => {
    setQuery("");
    setOpen(false);
    if (value === "__noco__") emit([], [], "__noco__");
    else emit([], zips, "__all__");
  };

  const addCity = (name) => {
    const set = new Set(cities.map((c) => c.toLowerCase()));
    if (set.has(name.toLowerCase())) {
      setQuery("");
      setOpen(false);
      return;
    }
    // Replacing a scope with first city; multi-add thereafter
    const next = [...cities, name];
    setQuery("");
    // Keep dropdown open for multi-add
    inputRef.current?.focus();
    emit(next, zips, null);
  };

  const addZip = (code) => {
    if (zips.includes(code)) {
      setQuery("");
      return;
    }
    const next = [...zips, code];
    setQuery("");
    inputRef.current?.focus();
    emit(cities, next, null);
  };

  const removeCity = (name) => {
    const next = cities.filter((c) => c.toLowerCase() !== name.toLowerCase());
    emit(next, zips, null);
  };

  const removeZip = (code) => {
    const next = zips.filter((z) => z !== code);
    emit(cities, next, null);
  };

  const clearScopeChip = () => {
    // Scope chip only shown when no multi selections; reset is a no-op to noco
    emit([], [], "__noco__");
  };

  const toggleQuickCity = (name) => {
    const has = cities.some((c) => c.toLowerCase() === name.toLowerCase());
    if (has) removeCity(name);
    else addCity(name);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Backspace" && !query) {
      if (zips.length) {
        e.preventDefault();
        removeZip(zips[zips.length - 1]);
      } else if (cities.length) {
        e.preventDefault();
        removeCity(cities[cities.length - 1]);
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      // Prefer exact city match, then zip, then first suggestion
      const exactCity = results.cities.find(
        (c) => c.value.toLowerCase() === q.toLowerCase()
      );
      if (exactCity) {
        addCity(exactCity.value);
        return;
      }
      if (/^\d{5}$/.test(q)) {
        addZip(q);
        return;
      }
      if (results.cities[0]) {
        addCity(results.cities[0].value);
        return;
      }
      if (results.zips[0]) {
        addZip(results.zips[0].value);
      }
    }
  };

  const placeholder = cities.length || zips.length
    ? "Add city or ZIP…"
    : "Search city or ZIP (e.g. Denver, 80202)…";

  return (
    <div className={`relative ${className}`} ref={wrapRef}>
      <div
        className={`flex flex-wrap items-center gap-1.5 min-h-[2.5rem] px-2.5 py-1.5 border border-gray-300 rounded-full bg-white focus-within:ring-2 focus-within:ring-black ${
          disabled ? "opacity-50 pointer-events-none" : ""
        } ${inputClassName}`}
        onClick={() => {
          if (disabled) return;
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {scopeLabel && (
          <span className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
            {scopeLabel}
            {city === "__all__" && (
              <button
                type="button"
                className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10"
                onClick={(e) => {
                  e.stopPropagation();
                  clearScopeChip();
                }}
                aria-label="Reset to Northern Colorado"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </span>
        )}
        {cities.map((c) => (
          <span
            key={`c-${c}`}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-semibold bg-[#CFB36E]/25 text-gray-900 border border-[#CFB36E]/50"
          >
            {c}
            <button
              type="button"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                removeCity(c);
              }}
              aria-label={`Remove ${c}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {zips.map((z) => (
          <span
            key={`z-${z}`}
            className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs font-semibold bg-[#CFB36E]/25 text-gray-900 border border-[#CFB36E]/50"
          >
            {z}
            <button
              type="button"
              className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-black/10"
              onClick={(e) => {
                e.stopPropagation();
                removeZip(z);
              }}
              aria-label={`Remove ZIP ${z}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          aria-label="Search city or ZIP"
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="flex-1 min-w-[10rem] border-0 outline-none bg-transparent text-sm py-1 px-1 placeholder:text-gray-400"
        />
        {loading && (
          <span
            className="inline-block w-3.5 h-3.5 border-2 border-[#CFB36E] border-t-transparent rounded-full animate-spin shrink-0"
            aria-hidden="true"
          />
        )}
      </div>

      {open && !disabled && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
        >
          {/* Search all of Colorado affordance */}
          {results.specials.map((s) => (
            <button
              key={s.value}
              type="button"
              role="option"
              onClick={() => selectScope(s.value)}
              className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm hover:bg-gray-50 ${
                (s.value === "__noco__" && city === "__noco__" && !cities.length && !zips.length)
                || (s.value === "__all__" && city === "__all__" && !cities.length)
                  ? "bg-[#CFB36E]/10 font-semibold"
                  : ""
              }`}
            >
              <span>
                {s.value === "__all__" ? "Search all of Colorado" : s.label}
              </span>
              <span className="text-xs text-gray-500 tabular-nums shrink-0">
                {formatCount(s.count)}
              </span>
            </button>
          ))}

          {results.cities.length > 0 && (
            <>
              <p className="px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-t border-gray-100">
                Cities
              </p>
              {results.cities.map((c) => {
                const selected = cities.some(
                  (x) => x.toLowerCase() === c.value.toLowerCase()
                );
                return (
                  <button
                    key={`city-${c.value}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => addCity(c.value)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-gray-50 ${
                      selected ? "bg-[#CFB36E]/15 font-semibold" : ""
                    }`}
                  >
                    <span>{c.label}</span>
                    <span className="text-xs text-gray-500 tabular-nums shrink-0">
                      {formatCount(c.count)}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {results.zips.length > 0 && (
            <>
              <p className="px-3.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 border-t border-gray-100">
                ZIP codes
              </p>
              {results.zips.map((z) => {
                const selected = zips.includes(z.value);
                return (
                  <button
                    key={`zip-${z.value}`}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => addZip(z.value)}
                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-gray-50 ${
                      selected ? "bg-[#CFB36E]/15 font-semibold" : ""
                    }`}
                  >
                    <span>{z.label}</span>
                    <span className="text-xs text-gray-500 tabular-nums shrink-0">
                      {formatCount(z.count)}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {!loading
            && query
            && results.cities.length === 0
            && results.zips.length === 0
            && results.specials.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-gray-500">
              No cities or ZIPs match “{query}”.
            </p>
          )}

          <p className="px-3.5 py-2 text-[11px] text-gray-400 border-t border-gray-100">
            Tip: select multiple cities or ZIPs — results are the union of those areas.
          </p>
        </div>
      )}

      {showQuickPicks && !disabled && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500 self-center mr-0.5">
            NoCO
          </span>
          {NOCO_CITY_LIST.map((name) => {
            const on = cities.some((c) => c.toLowerCase() === name.toLowerCase());
            return (
              <button
                key={name}
                type="button"
                onClick={() => toggleQuickCity(name)}
                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${
                  on
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-700 border-gray-300 hover:border-black"
                }`}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
