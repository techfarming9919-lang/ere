import React from "react";
import { Modal } from "./ui";
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

export default function AnalyzeDialog({ open, onClose, loading, result }) {
  return (
    <Modal open={open} onClose={onClose} title="Website Structure Analysis" wide testid="analyze-dialog">
      {loading && (
        <div className="flex items-center gap-3 py-10 justify-center" style={{ color: "var(--text-secondary)" }}>
          <Loader2 className="animate-spin" /> Inspecting the live portal…
        </div>
      )}

      {!loading && result && (
        <div className="space-y-4 fade-in">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium"
            style={{
              background: result.success ? "rgba(16,185,129,.1)" : "rgba(239,68,68,.1)",
              color: result.success ? "var(--success)" : "var(--failed)",
              border: `1px solid ${result.success ? "rgba(16,185,129,.3)" : "rgba(239,68,68,.3)"}`,
            }}
            data-testid="analyze-result-message">
            {result.success ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
            {result.message}
          </div>

          {result.detected && (
            <div>
              <div className="text-[11px] uppercase tracking-wider font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Detected Elements</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(result.detected).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-sm px-3 py-2 rounded-md border"
                    style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                    {v ? <CheckCircle2 size={15} style={{ color: "var(--success)" }} /> : <XCircle size={15} style={{ color: "var(--failed)" }} />}
                    <span style={{ color: v ? "var(--text-primary)" : "var(--text-muted)" }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoBox label={`Financial Year ${result.selected_financial_year || ""} available`}
              value={result.financial_year_available ? "YES — available" : "NO — pick a different year"}
              good={result.financial_year_available} />
            <InfoBox label="Districts discovered" value={result.district_count ?? "—"} good />
          </div>

          {result.financial_year_options?.length > 0 && (
            <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              FY options on site: {result.financial_year_options.join(", ")}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function InfoBox({ label, value, good }) {
  return (
    <div className="card p-3">
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="font-mono text-sm mt-1" style={{ color: good ? "var(--success)" : "var(--failed)" }}>{value}</div>
    </div>
  );
}
