import React from "react";

function ProgressStat({ label, done, total, testid, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="card p-4 flex flex-col justify-between" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold tracking-tight">
        {done}<span style={{ color: "var(--text-muted)" }} className="text-lg"> / {total}</span>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden mt-3" style={{ background: "var(--border-color)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function CountStat({ label, value, color, testid }) {
  return (
    <div className="card p-4 flex flex-col justify-between" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
    </div>
  );
}

export default function Stats({ s }) {
  const p = s.progress || {};
  const c = s.counts || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <ProgressStat label="Districts" done={p.districts?.done || 0} total={p.districts?.total || 0} color="var(--brand)" testid="stat-districts-progress" />
        <ProgressStat label="Sub Divisions" done={p.subdivisions?.done || 0} total={p.subdivisions?.total || 0} color="var(--brand)" testid="stat-subdivisions-progress" />
        <ProgressStat label="Blocks" done={p.blocks?.done || 0} total={p.blocks?.total || 0} color="var(--brand)" testid="stat-blocks-progress" />
        <ProgressStat label="Gram Panchayats" done={p.gps?.done || 0} total={p.gps?.total || 0} color="var(--duplicate)" testid="stat-gps-progress" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 sm:gap-4">
        <CountStat label="Successful" value={c.successful || 0} color="var(--success)" testid="stat-successful-count" />
        <CountStat label="Partial" value={c.partial || 0} color="var(--partial)" testid="stat-partial-count" />
        <CountStat label="Failed" value={c.failed || 0} color="var(--failed)" testid="stat-failed-count" />
        <CountStat label="Duplicates" value={c.duplicates || 0} color="var(--duplicate)" testid="stat-duplicate-count" />
        <CountStat label="Speed /min" value={s.speed_per_min ?? 0} color="var(--text-primary)" testid="stat-crawl-speed" />
        <CountStat label="Elapsed" value={s.elapsed || "00:00:00"} color="var(--text-primary)" testid="stat-elapsed-time" />
        <CountStat label="ETA" value={s.eta || "--:--:--"} color="var(--text-primary)" testid="stat-eta-timer" />
      </div>
    </div>
  );
}
