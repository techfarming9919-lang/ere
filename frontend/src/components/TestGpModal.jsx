import React, { useEffect, useState } from "react";
import { Modal, Btn, StatusBadge } from "./ui";
import { FlaskConical, Lock, Mail, Phone, AlertTriangle, CheckCircle2 } from "lucide-react";
import api from "../api";

function Dropdown({ label, value, options, onChange, loading, disabled, testid }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{label}</label>
      <select
        data-testid={testid}
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm px-3 py-2 rounded-md border bg-transparent outline-none disabled:opacity-40"
        style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }}
      >
        <option value="" style={{ background: "var(--bg-card)" }}>{loading ? "Loading…" : `Select ${label}`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "var(--bg-card)" }}>{o.text}</option>
        ))}
      </select>
    </div>
  );
}

export default function TestGpModal({ open, onClose, fyLabel, onSaved }) {
  const [districts, setDistricts] = useState([]);
  const [subdivisions, setSubdivisions] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [gps, setGps] = useState([]);
  const [sel, setSel] = useState({ d: "", sd: "", b: "", g: "" });
  const [loading, setLoading] = useState({});
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const textOf = (arr, v) => arr.find((o) => o.value === v)?.text || "";

  useEffect(() => {
    if (!open) return;
    setErr(""); setResult(null);
    setSel({ d: "", sd: "", b: "", g: "" });
    setSubdivisions([]); setBlocks([]); setGps([]);
    (async () => {
      setLoading((l) => ({ ...l, d: true }));
      const res = await api.discover({ level: "districts" });
      setLoading((l) => ({ ...l, d: false }));
      if (res.success) setDistricts(res.options);
      else setErr(res.message || "Could not load districts (site may be unreachable from this server).");
    })();
  }, [open]);

  const pickDistrict = async (v) => {
    setSel({ d: v, sd: "", b: "", g: "" }); setSubdivisions([]); setBlocks([]); setGps([]); setErr("");
    if (!v) return;
    setLoading((l) => ({ ...l, sd: true }));
    const res = await api.discover({ level: "subdivisions", district: v });
    setLoading((l) => ({ ...l, sd: false }));
    res.success ? setSubdivisions(res.options) : setErr(res.message || "Failed to load sub divisions");
  };
  const pickSub = async (v) => {
    setSel((s) => ({ ...s, sd: v, b: "", g: "" })); setBlocks([]); setGps([]); setErr("");
    if (!v) return;
    setLoading((l) => ({ ...l, b: true }));
    const res = await api.discover({ level: "blocks", district: sel.d, subdivision: v });
    setLoading((l) => ({ ...l, b: false }));
    res.success ? setBlocks(res.options) : setErr(res.message || "Failed to load blocks");
  };
  const pickBlock = async (v) => {
    setSel((s) => ({ ...s, b: v, g: "" })); setGps([]); setErr("");
    if (!v) return;
    setLoading((l) => ({ ...l, g: true }));
    const res = await api.discover({ level: "gps", district: sel.d, subdivision: sel.sd, block: v });
    setLoading((l) => ({ ...l, g: false }));
    res.success ? setGps(res.options) : setErr(res.message || "Failed to load Gram Panchayats");
  };

  const runTest = async () => {
    setErr(""); setResult(null); setTesting(true);
    const body = {
      district_value: sel.d, district_text: textOf(districts, sel.d),
      subdivision_value: sel.sd, subdivision_text: textOf(subdivisions, sel.sd),
      block_value: sel.b, block_text: textOf(blocks, sel.b),
      gp_value: sel.g, gp_text: textOf(gps, sel.g),
    };
    const res = await api.testGp(body);
    setTesting(false);
    if (res.success) { setResult(res); onSaved && onSaved(); }
    else setErr(res.message || "Test failed");
  };

  return (
    <Modal open={open} onClose={onClose} title="Test Single GP" wide testid="test-gp-modal">
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-md text-xs font-mono font-bold"
        style={{ background: "rgba(67,56,202,.15)", color: "#C7D2FE", border: "1px solid #4338CA55" }}>
        <Lock size={13} /> Testing with Financial Year {fyLabel}. Change it from the header selector.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Dropdown label="District" value={sel.d} options={districts} onChange={pickDistrict} loading={loading.d} testid="test-select-district" />
        <Dropdown label="Sub Division" value={sel.sd} options={subdivisions} onChange={pickSub} loading={loading.sd} disabled={!sel.d} testid="test-select-subdivision" />
        <Dropdown label="Block" value={sel.b} options={blocks} onChange={pickBlock} loading={loading.b} disabled={!sel.sd} testid="test-select-block" />
        <Dropdown label="Gram Panchayat" value={sel.g} options={gps} onChange={(v) => setSel((s) => ({ ...s, g: v }))} loading={loading.g} disabled={!sel.b} testid="test-select-gp" />
      </div>

      {err && (
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-md text-xs"
          style={{ background: "rgba(239,68,68,.1)", color: "var(--failed)", border: "1px solid rgba(239,68,68,.3)" }}>
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span className="font-mono">{err}</span>
        </div>
      )}

      {result && (
        <div className="mt-4 card p-4 fade-in" data-testid="test-gp-result">
          <div className="flex items-center justify-between mb-3">
            <span className="font-head font-semibold">{result.gp}</span>
            <StatusBadge status={result.status} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <Field icon={Mail} label="GP Email ID" value={result.email} />
            <Field icon={Phone} label="GIS Mobile No1" value={result.mob1} />
            <Field icon={Phone} label="GIS Mobile No2" value={result.mob2} />
          </div>
          <div className="mt-3 text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>
            {result.district} → {result.subdivision} → {result.block} · FY {result.financial_year}
          </div>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Close</Btn>
        <Btn variant="primary" icon={FlaskConical} loading={testing} disabled={!sel.g || testing} onClick={runTest} data-testid="btn-run-test">
          Test Extraction
        </Btn>
      </div>
    </Modal>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div className="rounded-md p-3 border" style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold mb-1" style={{ color: "var(--text-muted)" }}>
        <Icon size={12} /> {label}
      </div>
      <div className="font-mono text-sm break-all" style={{ color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        {value || "[blank]"}
      </div>
    </div>
  );
}
