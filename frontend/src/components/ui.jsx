import React from "react";
import { Loader2 } from "lucide-react";

export function Btn({ variant = "outline", icon: Icon, children, className = "", loading, ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const variants = {
    primary: "text-white shadow-sm",
    danger: "text-white shadow-sm",
    warning: "text-white shadow-sm",
    outline: "border",
    ghost: "",
  };
  const styleMap = {
    primary: { background: "var(--brand)" },
    danger: { background: "var(--failed)" },
    warning: { background: "var(--partial)" },
    outline: { background: "var(--bg-card)", borderColor: "var(--border-accent)", color: "var(--text-primary)" },
    ghost: { color: "var(--text-secondary)" },
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      style={styleMap[variant]}
      {...props}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  );
}

const STATUS_STYLES = {
  SUCCESS: { bg: "rgba(16,185,129,.12)", color: "var(--success)", label: "SUCCESS" },
  PARTIAL: { bg: "rgba(245,158,11,.12)", color: "var(--partial)", label: "PARTIAL" },
  FAILED: { bg: "rgba(239,68,68,.12)", color: "var(--failed)", label: "FAILED" },
  DUPLICATE: { bg: "rgba(139,92,246,.12)", color: "var(--duplicate)", label: "DUPLICATE" },
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || { bg: "rgba(148,163,184,.12)", color: "var(--text-secondary)", label: status || "—" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-semibold border"
      style={{ background: s.bg, color: s.color, borderColor: s.color + "55" }}
      data-testid={`status-badge-${(status || "none").toLowerCase()}`}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

export function Modal({ open, onClose, title, children, wide, testid }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ background: "rgba(0,0,0,.6)" }} onMouseDown={onClose} data-testid={testid}>
      <div className={`card fade-in w-full ${wide ? "max-w-3xl" : "max-w-xl"} mt-6`}
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <h3 className="font-head text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="text-sm px-2 py-1 rounded hover:opacity-70" data-testid="modal-close"
            style={{ color: "var(--text-muted)" }}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
