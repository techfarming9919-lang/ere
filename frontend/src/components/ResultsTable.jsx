import React, { useEffect, useState, useCallback } from "react";
import { Search, Mail, Phone } from "lucide-react";
import { StatusBadge } from "./ui";
import api from "../api";

const STATUSES = ["ALL", "SUCCESS", "PARTIAL", "FAILED"];

export default function ResultsTable({ tick }) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [district, setDistrict] = useState("ALL");
  const [page, setPage] = useState(0);
  const limit = 50;

  const load = useCallback(async () => {
    const data = await api.records({
      status, search: search || undefined,
      district: district === "ALL" ? undefined : district,
      limit, offset: page * limit,
    });
    setRows(data.rows);
    setTotal(data.total);
  }, [status, search, district, page]);

  useEffect(() => { load(); }, [load, tick]);

  const districts = Array.from(new Set(rows.map((r) => r.district))).filter(Boolean);

  return (
    <div className="card overflow-hidden" data-testid="data-table-results">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-1.5 rounded-md border"
          style={{ borderColor: "var(--border-accent)", background: "var(--bg-main)" }}>
          <Search size={15} style={{ color: "var(--text-muted)" }} />
          <input
            data-testid="input-table-search"
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
            placeholder="Search GP, email, mobile, block…"
            className="bg-transparent outline-none text-sm w-full"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
        <select data-testid="select-status-filter" value={status}
          onChange={(e) => { setPage(0); setStatus(e.target.value); }}
          className="text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
          style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }}>
          {STATUSES.map((s) => <option key={s} value={s} style={{ background: "var(--bg-card)" }}>{s}</option>)}
        </select>
        <select data-testid="select-district-filter" value={district}
          onChange={(e) => { setPage(0); setDistrict(e.target.value); }}
          className="text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none max-w-[160px]"
          style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }}>
          <option value="ALL" style={{ background: "var(--bg-card)" }}>All Districts</option>
          {districts.map((d) => <option key={d} value={d} style={{ background: "var(--bg-card)" }}>{d}</option>)}
        </select>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{total} records</div>
      </div>

      <div className="overflow-x-auto scroll-thin max-h-[460px] overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0" style={{ background: "var(--bg-card-hover)" }}>
            <tr className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {["District", "Sub Div", "Block", "Gram Panchayat", "Email", "GIS Mob1", "GIS Mob2", "Status"].map((h) => (
                <th key={h} className="px-3 py-2.5 whitespace-nowrap border-b" style={{ borderColor: "var(--border-color)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No records yet. Run <b>Test Single GP</b> or <b>Start Full Crawl</b>.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="text-sm border-b transition-colors hover:bg-[var(--bg-card-hover)]"
                style={{ borderColor: "var(--border-color)" }}>
                <td className="px-3 py-2.5 whitespace-nowrap">{r.district}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.subdivision}</td>
                <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.block}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-medium">{r.gp}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs" style={{ color: r.email ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {r.email || "—"}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs" style={{ color: r.mob1 ? "var(--text-primary)" : "var(--text-muted)" }}>{r.mob1 || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs" style={{ color: r.mob2 ? "var(--text-primary)" : "var(--text-muted)" }}>{r.mob2 || "—"}</td>
                <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t text-xs font-mono"
          style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-30 px-2 py-1">← Prev</button>
          <span>Page {page + 1} / {Math.ceil(total / limit)}</span>
          <button disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-30 px-2 py-1">Next →</button>
        </div>
      )}
    </div>
  );
}
