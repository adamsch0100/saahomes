import React, { useEffect, useState } from "react";
import { getFunnelStats } from "../../utils/api.js";

const RANGES = [7, 30, 90];

/** Search-to-lead funnel: how many people reach each step, from the event stream. */
export default function FunnelView({ token }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getFunnelStats(token, days)
      .then((r) => live && setData(r.data))
      .catch((e) => live && setError(e.message || "Could not load the funnel."))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token, days]);

  const top = data?.steps?.[0]?.people || 0;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Search-to-lead funnel</h2>
          <p className="text-sm text-gray-500 mt-1">
            People who reached each step in the last {days} days. Browsing before signup counts toward the contact it led to.
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${days === d ? "bg-black text-white" : "border border-gray-200 text-gray-700 hover:border-black"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <div className="p-6">
        {loading && <div className="h-40 bg-gray-50 rounded animate-pulse" aria-busy="true" />}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && data && (
          <>
            {top === 0 ? (
              <p className="text-sm text-gray-500">No tracked visits yet in this window. Visits start counting from the day tracking shipped.</p>
            ) : (
              <ol className="space-y-3">
                {data.steps.map((s) => (
                  <li key={s.key}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="font-semibold text-gray-900">{s.label}</span>
                      <span className="text-gray-600 tabular-nums">
                        {s.people.toLocaleString()} <span className="text-gray-400">· {s.pct_of_visitors}%</span>
                        {s.pct_of_previous != null && (
                          <span className="text-gray-400"> · {s.pct_of_previous}% of previous</span>
                        )}
                      </span>
                    </div>
                    <div className="mt-1.5 h-3 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#CFB36E]"
                        style={{ width: `${top ? Math.max(1, (s.people / top) * 100) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {data.signups_by_form?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-900">Signups by form</h3>
                <ul className="mt-2 text-sm text-gray-600 space-y-1">
                  {data.signups_by_form.map((r) => (
                    <li key={r.via} className="flex justify-between max-w-xs">
                      <span>{r.via.replace(/_/g, " ")}</span>
                      <span className="tabular-nums">{r.n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
