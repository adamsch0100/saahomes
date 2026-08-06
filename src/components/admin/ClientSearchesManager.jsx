import React, { useCallback, useEffect, useState } from "react";

const API_BASE = (() => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL.replace(/\/$/, "");
  if (import.meta.env.DEV) return "http://localhost:3000";
  return "";
})();

const TYPE_LABEL = { detached: "Detached home", attached: "Condo / townhome / attached", land: "Land", commercial: "Commercial" };
const FREQ_LABEL = { daily: "Daily", weekly: "Weekly", immediate: "As it happens" };

function filtersText(f = {}) {
  const fmt = (n) => (n ? `$${Number(n).toLocaleString()}` : "Any");
  const parts = [];
  if (f.city) parts.push(f.city);
  if (f.minPrice || f.maxPrice) parts.push(`${fmt(f.minPrice)} – ${fmt(f.maxPrice)}`);
  if (f.beds) parts.push(`${f.beds}+ bd`);
  if (f.baths) parts.push(`${f.baths}+ ba`);
  if (f.type && TYPE_LABEL[f.type]) parts.push(TYPE_LABEL[f.type]);
  return parts.length ? parts.join(" · ") : "Anywhere";
}

function scheduleText(s) {
  if (s.frequency === "immediate") return "Immediate";
  const t = s.send_time || "06:00";
  const [hh] = t.split(":");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const ap = hh < 12 ? "AM" : "PM";
  return s.frequency === "weekly" ? `Weekly · ${s.send_day || "Monday"} ${h12}:00 ${ap}` : `Daily ${h12}:00 ${ap}`;
}

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const EMPTY_FORM = {
  client_email: "", client_name: "", client_phone: "",
  name: "", city: "", minPrice: "", maxPrice: "", beds: "", type: "",
  frequency: "daily", send_time: "06:00", send_day: "Monday",
};

export default function ClientSearchesManager({ token }) {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, s] = await Promise.all([
        fetch(`${API_BASE}/api/admin/searches?q=${encodeURIComponent(q)}`, { headers }).then((r) => r.json()),
        fetch(`${API_BASE}/api/admin/search-stats`, { headers }).then((r) => r.json()),
      ]);
      if (!u.success) throw new Error(u.error || "Failed to load");
      setUsers(u.data || []);
      setStats(s.data || null);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  }, [q, token]);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const createSearch = async (e) => {
    e.preventDefault();
    setError(null);
    const filters = {};
    if (form.city) filters.city = form.city;
    if (form.minPrice) filters.minPrice = form.minPrice;
    if (form.maxPrice) filters.maxPrice = form.maxPrice;
    if (form.beds) filters.beds = form.beds;
    if (form.type) filters.type = form.type;
    try {
      const res = await fetch(`${API_BASE}/api/admin/searches`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, filters }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error || "Could not create");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      load();
    } catch (err) { setError(err.message); }
  };

  const toggleActive = async (search) => {
    try {
      await fetch(`${API_BASE}/api/admin/searches/${search.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !search.is_active }),
      });
      load();
    } catch (err) { setError(err.message); }
  };

  const saveEdit = async (searchId) => {
    const filters = {};
    if (editForm.city) filters.city = editForm.city;
    if (editForm.minPrice) filters.minPrice = editForm.minPrice;
    if (editForm.maxPrice) filters.maxPrice = editForm.maxPrice;
    if (editForm.beds) filters.beds = editForm.beds;
    if (editForm.type) filters.type = editForm.type;
    const body = { name: editForm.name, filters, frequency: editForm.frequency, send_time: editForm.send_time, send_day: editForm.send_day };
    try {
      await fetch(`${API_BASE}/api/admin/searches/${searchId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setEditing(null);
      load();
    } catch (err) { setError(err.message); }
  };

  const removeSearch = async (searchId) => {
    if (!window.confirm("Delete this client's saved search?")) return;
    try {
      await fetch(`${API_BASE}/api/admin/searches/${searchId}`, { method: "DELETE", headers });
      load();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            ["Total users", stats.total_users],
            ["Saved searches", stats.total_searches],
            ["Active", stats.active_searches],
            ["New users (7d)", stats.users_7d],
            ["Showings", stats.total_showings],
          ].map(([label, value]) => (
            <div key={label} className="bg-white p-4 rounded-lg shadow">
              <p className="text-xs text-gray-500 font-medium">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email, name, or phone…"
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm w-full sm:w-80"
        />
        <button
          type="button"
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800"
        >
          {showCreate ? "Cancel" : "+ Create search for client"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createSearch} className="bg-white rounded-lg shadow p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input required value={form.client_email} onChange={(e) => setF("client_email", e.target.value)} placeholder="Client email *" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          <input value={form.client_name} onChange={(e) => setF("client_name", e.target.value)} placeholder="Client name" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          <input value={form.client_phone} onChange={(e) => setF("client_phone", e.target.value)} placeholder="Client phone" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          <input value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Search name (e.g. FC 3-bed under $600K)" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          <input value={form.city} onChange={(e) => setF("city", e.target.value)} placeholder="City (e.g. Fort Collins)" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.minPrice} onChange={(e) => setF("minPrice", e.target.value)} placeholder="Min $" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
            <input value={form.maxPrice} onChange={(e) => setF("maxPrice", e.target.value)} placeholder="Max $" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
          </div>
          <select value={form.beds} onChange={(e) => setF("beds", e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Any beds</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option><option value="5">5+</option>
          </select>
          <select value={form.type} onChange={(e) => setF("type", e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="">Any type</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={form.frequency} onChange={(e) => setF("frequency", e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
            {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="flex items-center gap-2">
            {form.frequency === "weekly" && (
              <select value={form.send_day} onChange={(e) => setF("send_day", e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            {form.frequency !== "immediate" && (
              <select value={form.send_time} onChange={(e) => setF("send_time", e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white">
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
            )}
          </div>
          <button type="submit" className="px-4 py-2.5 bg-[#CFB36E] text-black rounded-lg text-sm font-bold hover:bg-[#bd9f5a]">Create search</button>
        </form>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {loading && <p className="text-gray-500 text-sm">Loading…</p>}

      <div className="space-y-4">
        {users.length === 0 && !loading && <p className="text-gray-500 text-sm">No users found.</p>}
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-lg shadow overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              className="w-full flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-gray-50 text-left"
            >
              <div>
                <p className="font-semibold text-gray-900">{u.name || u.email}</p>
                <p className="text-sm text-gray-500">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{u.search_count} search{u.search_count === 1 ? "" : "es"}</span>
                <span className={u.active_count > 0 ? "text-emerald-600 font-semibold" : ""}>{u.active_count} active</span>
                <span>{new Date(u.created_at).toLocaleDateString()}</span>
                <span className="text-gray-400">{expanded === u.id ? "▲" : "▼"}</span>
              </div>
            </button>
            {expanded === u.id && (
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {u.searches.length === 0 && <p className="p-4 text-sm text-gray-400">No saved searches.</p>}
                {u.searches.map((s) => (
                  <div key={s.id} className="p-4">
                    {editing === s.id ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <input defaultValue={s.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Name" />
                        <input defaultValue={s.filters?.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="City" />
                        <input defaultValue={s.filters?.minPrice || ""} onChange={(e) => setEditForm({ ...editForm, minPrice: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Min $" />
                        <input defaultValue={s.filters?.maxPrice || ""} onChange={(e) => setEditForm({ ...editForm, maxPrice: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Max $" />
                        <input defaultValue={s.filters?.beds || ""} onChange={(e) => setEditForm({ ...editForm, beds: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Beds" />
                        <select defaultValue={s.filters?.type || ""} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                          <option value="">Any type</option>
                          {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <select defaultValue={s.frequency || "daily"} onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                          {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => saveEdit(s.id)} className="px-3 py-2 bg-black text-white rounded-lg text-xs font-semibold">Save</button>
                          <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 flex items-center gap-2">
                            {s.name}
                            {s.is_active
                              ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">ACTIVE</span>
                              : <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">PAUSED</span>}
                          </p>
                          <p className="text-sm text-gray-500">{filtersText(s.filters)}</p>
                          <p className="text-xs text-gray-400">{scheduleText(s)}{s.last_email_at ? ` · last emailed ${new Date(s.last_email_at).toLocaleDateString()}` : " · never emailed yet"}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => toggleActive(s)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:border-black">{s.is_active ? "Pause" : "Resume"}</button>
                          <button type="button" onClick={() => { setEditing(s.id); setEditForm({ name: s.name, city: s.filters?.city || "", minPrice: s.filters?.minPrice || "", maxPrice: s.filters?.maxPrice || "", beds: s.filters?.beds || "", type: s.filters?.type || "", frequency: s.frequency || "daily" }); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium hover:border-black">Edit</button>
                          <button type="button" onClick={() => removeSearch(s.id)} className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-medium hover:border-red-400">Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
