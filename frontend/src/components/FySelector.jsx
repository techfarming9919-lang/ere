import React, { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, Loader2, RefreshCw, AlertTriangle, Plus, Check } from "lucide-react";
import api from "../api";

/**
 * Header control that lets the user manually pick the Financial Year to crawl.
 * - "Load years from site" fetches the real FY options from the live portal.
 * - If the site is unreachable, the user can add a year manually (label + value).
 * - Disabled while a crawl is running/paused.
 */
export default function FySelector({ cfg, onChanged, disabled }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState(false);
  const [mText, setMText] = useState("");
  const [mValue, setMValue] = useState("");
  const ref = useRef(null);

  const currentLabel = cfg?.financial_year_label || "2024 - 2025";
  const currentValue = cfg?.financial_year_value || "";

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const loadYears = async () => {
    setLoading(true); setErr("");
    try {
      const res = await api.financialYears();
      if (res.success) {
        setOptions(res.options || []);
        if (!res.options?.length) setErr("No Financial Year options found on the site.");
      } else {
        setErr(res.message || "Could not reach the portal. Add a year manually below.");
      }
    } catch (e) {
      setErr("Request failed. Add a year manually below.");
    } finally {
      setLoading(false);
    }
  };

  const choose = async (value, text) => {
    if (!value || !text) return;
    setSaving(true); setErr("");
    try {
      const res = await api.setFinancialYear({ value, text });
      if (res.ok) {
        onChanged && onChanged(res.financial_year);
        setOpen(false); setManual(false); setMText(""); setMValue("");
      } else {
        setErr(res.message || "Could not set the Financial Year.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        data-testid="fy-selector-btn"
        disabled={disabled}
        onClick={() => { setOpen((o) => !o); if (!options.length && !open) loadYears(); }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold tracking-wide border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: "rgba(67,56,202,.15)", color: "#C7D2FE", borderColor: "#4338CA66" }}
        title={disabled ? "Stop the crawl to change the Financial Year" : "Click to change the Financial Year"}
      >
        <Calendar size={13} /> FY {currentLabel}
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
      </button>

      {open && (
        <div
          data-testid="fy-selector-dropdown"
          className="absolute right-0 mt-2 w-80 rounded-lg border shadow-xl z-50 fade-in"
          style={{ background: "var(--bg-card)", borderColor: "var(--border-accent)" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
            <span className="text-sm font-head font-semibold">Select Financial Year</span>
            <button onClick={loadYears} disabled={loading} data-testid="fy-reload-btn"
              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border disabled:opacity-50"
              style={{ borderColor: "var(--border-accent)", color: "var(--text-secondary)" }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Load from site
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center gap-2 px-3 py-4 text-sm justify-center" style={{ color: "var(--text-muted)" }}>
                <Loader2 size={15} className="animate-spin" /> Reading years from the portal…
              </div>
            )}

            {!loading && options.map((o) => {
              const active = o.value === currentValue || o.text.replace(/\s/g, "") === currentLabel.replace(/\s/g, "");
              return (
                <button key={o.value} data-testid={`fy-option-${o.value}`} disabled={saving}
                  onClick={() => choose(o.value, o.text)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-all hover:opacity-80"
                  style={{ background: active ? "rgba(67,56,202,.18)" : "transparent", color: "var(--text-primary)" }}>
                  <span className="font-mono">{o.text}</span>
                  {active && <Check size={14} style={{ color: "var(--success)" }} />}
                </button>
              );
            })}

            {!loading && !options.length && !manual && (
              <div className="px-3 py-3 text-xs" style={{ color: "var(--text-muted)" }}>
                Click “Load from site” to fetch available years, or add one manually.
              </div>
            )}
          </div>

          {err && (
            <div className="mx-3 mb-2 flex items-start gap-2 px-3 py-2 rounded-md text-[11px]"
              style={{ background: "rgba(245,158,11,.12)", color: "var(--partial)", border: "1px solid rgba(245,158,11,.3)" }}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" /> <span className="font-mono">{err}</span>
            </div>
          )}

          <div className="border-t px-3 py-3" style={{ borderColor: "var(--border-color)" }}>
            {!manual ? (
              <button data-testid="fy-manual-toggle" onClick={() => setManual(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "var(--brand)" }}>
                <Plus size={13} /> Add a year manually
              </button>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>Add Year Manually</div>
                <input data-testid="fy-manual-text" value={mText} onChange={(e) => setMText(e.target.value)}
                  placeholder="Label (e.g. 2023 - 2024)"
                  className="w-full text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
                  style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
                <input data-testid="fy-manual-value" value={mValue} onChange={(e) => setMValue(e.target.value)}
                  placeholder="Option value (e.g. 2324)"
                  className="w-full text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
                  style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => setManual(false)} className="text-xs px-2 py-1" style={{ color: "var(--text-muted)" }}>Cancel</button>
                  <button data-testid="fy-manual-save" disabled={!mText || !mValue || saving}
                    onClick={() => choose(mValue.trim(), mText.trim())}
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
                    style={{ background: "var(--brand)", color: "#fff" }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Use this year
                  </button>
                </div>
                <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  The value is the site’s dropdown &lt;option value&gt; for that year.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
