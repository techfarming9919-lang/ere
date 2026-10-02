import React, { useEffect, useRef } from "react";
import { Terminal, Download, ArrowDownToLine } from "lucide-react";

const LEVEL_COLOR = {
  INFO: "#38BDF8",
  WARN: "#FBBF24",
  ERROR: "#FB7185",
  SUCCESS: "#34D399",
  DEBUG: "#94A3B8",
};

export default function LogConsole({ logs, logsUrl }) {
  const ref = useRef(null);
  const [autoscroll, setAutoscroll] = React.useState(true);
  useEffect(() => {
    if (autoscroll && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs, autoscroll]);

  return (
    <div className="card flex flex-col h-[520px]" data-testid="log-console-container">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Terminal size={16} style={{ color: "var(--brand)" }} />
          <span className="font-head">Live Log Console</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoscroll((v) => !v)}
            data-testid="btn-log-autoscroll-toggle"
            className="text-[11px] px-2 py-1 rounded border inline-flex items-center gap-1"
            style={{ borderColor: "var(--border-accent)", color: autoscroll ? "var(--success)" : "var(--text-muted)" }}
          >
            <ArrowDownToLine size={12} /> Auto
          </button>
          <a href={logsUrl} data-testid="btn-log-download"
            className="text-[11px] px-2 py-1 rounded border inline-flex items-center gap-1"
            style={{ borderColor: "var(--border-accent)", color: "var(--text-secondary)" }}>
            <Download size={12} /> Save
          </a>
        </div>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto scroll-thin px-4 py-3 font-mono text-[11.5px] leading-relaxed"
        style={{ background: "var(--log-bg)" }}>
        {(!logs || logs.length === 0) && (
          <div style={{ color: "#475569" }}>Waiting for crawler activity…</div>
        )}
        {logs?.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap break-words">
            <span style={{ color: "#475569" }}>[{l.time}]</span>{" "}
            <span style={{ color: LEVEL_COLOR[l.level] || "#94A3B8" }}>{l.level}</span>{" "}
            <span style={{ color: "#E2E8F0" }}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
