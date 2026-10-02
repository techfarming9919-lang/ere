import React, { useEffect, useState, useCallback, useRef } from "react";
import "@/App.css";
import {
  ScanSearch, FlaskConical, Play, Pause, Square, RotateCcw, Trash2,
  FileSpreadsheet, Download, Sun, Moon, Activity, Database, ChevronRight, AlertTriangle, Settings as SettingsIcon,
} from "lucide-react";
import api from "@/api";
import { Btn } from "@/components/ui";
import Stats from "@/components/Stats";
import LogConsole from "@/components/LogConsole";
import ResultsTable from "@/components/ResultsTable";
import TestGpModal from "@/components/TestGpModal";
import AnalyzeDialog from "@/components/AnalyzeDialog";
import SettingsModal from "@/components/SettingsModal";
import FySelector from "@/components/FySelector";

const EMPTY_STATUS = {
  state: "idle", current: {}, progress: {}, counts: {}, totals: {},
  speed_per_min: 0, elapsed: "00:00:00", eta: "--:--:--", logs: [],
};

function Header({ dark, setDark, cfg, onFyChanged, fyLocked }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-4 border-b"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "var(--brand)" }}>
          <Database size={20} color="#fff" />
        </div>
        <div>
          <h1 className="font-head text-lg sm:text-xl font-bold tracking-tight leading-none">ISGPP GP Profile Crawler</h1>
          <a href={cfg?.target_url} target="_blank" rel="noreferrer"
            className="text-[11px] font-mono hover:underline" style={{ color: "var(--text-muted)" }}>
            {cfg?.target_url || "gpims.wb.gov.in"}
          </a>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <FySelector cfg={cfg} onChanged={onFyChanged} disabled={fyLocked} />
        <button onClick={() => setDark((d) => !d)} data-testid="btn-theme-toggle"
          className="w-9 h-9 rounded-md border flex items-center justify-center"
          style={{ borderColor: "var(--border-accent)", color: "var(--text-secondary)" }}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}

function StatePill({ state }) {
  const map = {
    running: { c: "var(--success)", t: "RUNNING" },
    paused: { c: "var(--partial)", t: "PAUSED" },
    stopping: { c: "var(--failed)", t: "STOPPING" },
    done: { c: "var(--brand)", t: "COMPLETE" },
    error: { c: "var(--failed)", t: "ERROR" },
    idle: { c: "var(--text-muted)", t: "IDLE" },
  };
  const s = map[state] || map.idle;
  const live = state === "running";
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-mono font-bold border"
      style={{ color: s.c, borderColor: s.c + "55", background: s.c + "14" }} data-testid="crawl-state-pill">
      <span className={`w-2 h-2 rounded-full ${live ? "live-dot" : ""}`} style={{ background: s.c }} />
      {s.t}
    </span>
  );
}

function App() {
  const [dark, setDark] = useState(true);
  const [cfg, setCfg] = useState(null);
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [tableTick, setTableTick] = useState(0);
  const [showTest, setShowTest] = useState(false);
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeResult, setAnalyzeResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("light", !dark);
  }, [dark]);

  useEffect(() => { api.config().then(setCfg).catch(() => {}); }, []);

  const poll = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 1500);
    return () => clearInterval(id);
  }, [poll]);

  // refresh table + summary while active
  useEffect(() => {
    const id = setInterval(() => {
      setTableTick((t) => t + 1);
      api.summary().then(setSummary).catch(() => {});
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const act = async (fn, label) => {
    setBusy(label);
    try { await fn(); await poll(); setTableTick((t) => t + 1); }
    finally { setBusy(""); }
  };

  const runAnalyze = async () => {
    setShowAnalyze(true); setAnalyzeLoading(true); setAnalyzeResult(null);
    try { setAnalyzeResult(await api.analyze()); }
    catch (e) { setAnalyzeResult({ success: false, message: "Request failed: " + (e.message || e) }); }
    finally { setAnalyzeLoading(false); }
  };

  const st = status.state;
  const running = st === "running";
  const paused = st === "paused";
  const active = running || paused || st === "stopping";

  const exportBtns = [
    { scope: "all", label: "Export All", primary: true },
    { scope: "successful", label: "Successful" },
    { scope: "partial", label: "Partial" },
    { scope: "failed", label: "Failed" },
    { scope: "missing", label: "Missing Contacts" },
  ];

  const completeness = summary?.completeness || [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)" }}>
      <Header dark={dark} setDark={setDark} cfg={cfg}
        fyLocked={active}
        onFyChanged={(fy) => {
          setCfg((c) => ({ ...c, financial_year: fy.label, financial_year_label: fy.text, financial_year_value: fy.value }));
          setTableTick((t) => t + 1);
          api.summary().then(setSummary).catch(() => {});
        }} />

      <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1500px] mx-auto">
        {/* Control bar */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto flex-wrap">
            <Btn variant="outline" icon={ScanSearch} onClick={runAnalyze} data-testid="btn-analyze-website">Analyze Website</Btn>
            <Btn variant="outline" icon={FlaskConical} onClick={() => setShowTest(true)} data-testid="btn-test-single-gp">Test Single GP</Btn>
            <Btn variant="outline" icon={SettingsIcon} onClick={() => setShowSettings(true)} data-testid="btn-settings">Settings</Btn>
            <div className="w-px h-7 mx-1" style={{ background: "var(--border-accent)" }} />
            {!active && (
              <Btn variant="primary" icon={Play} loading={busy === "start"}
                onClick={() => act(() => api.start(cfg?.crawler), "start")} data-testid="btn-start-crawl">
                {st === "idle" && (status.counts?.successful || status.counts?.failed) ? "Resume Crawl" : "Start Full Crawl"}
              </Btn>
            )}
            {running && (
              <Btn variant="warning" icon={Pause} loading={busy === "pause"}
                onClick={() => act(api.pause, "pause")} data-testid="btn-pause-crawl">Pause</Btn>
            )}
            {paused && (
              <Btn variant="primary" icon={Play} loading={busy === "resume"}
                onClick={() => act(api.resume, "resume")} data-testid="btn-resume-crawl">Resume</Btn>
            )}
            {active && (
              <Btn variant="danger" icon={Square} loading={busy === "stop"}
                onClick={() => act(api.stop, "stop")} data-testid="btn-stop-crawl">Stop</Btn>
            )}
            <Btn variant="outline" icon={RotateCcw} disabled={active} loading={busy === "retry"}
              onClick={() => act(api.retryFailed, "retry")} data-testid="btn-retry-failed">Retry Failed</Btn>
            <Btn variant="ghost" icon={Trash2} disabled={active}
              onClick={() => { if (window.confirm("Clear all crawled data?")) act(api.reset, "reset"); }} data-testid="btn-reset">Reset</Btn>
          </div>
          <StatePill state={st} />
        </div>

        {/* Current position */}
        <div className="card px-4 py-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-mono" data-testid="current-position">
          <Activity size={15} style={{ color: "var(--brand)" }} className="mr-1" />
          {[status.current?.district, status.current?.subdivision, status.current?.block, status.current?.gp]
            .filter(Boolean).length === 0
            ? <span style={{ color: "var(--text-muted)" }}>No GP in progress</span>
            : ["district", "subdivision", "block", "gp"].map((k, i) => (
                status.current?.[k] ? (
                  <span key={k} className="flex items-center gap-2">
                    {i > 0 && <ChevronRight size={13} style={{ color: "var(--text-muted)" }} />}
                    <span style={{ color: i === 3 ? "var(--text-primary)" : "var(--text-secondary)" }}>{status.current[k]}</span>
                  </span>
                ) : null
              ))}
        </div>

        <Stats s={status} />

        {/* Split: results + logs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <ResultsTable tick={tableTick} />
          </div>
          <div className="lg:col-span-4">
            <LogConsole logs={status.logs} logsUrl={api.logsUrl()} />
          </div>
        </div>

        {/* Completeness */}
        {completeness.length > 0 && (
          <div className="card p-4" data-testid="completeness-report">
            <div className="flex items-center gap-2 font-head font-semibold mb-3">
              <AlertTriangle size={16} style={{ color: "var(--partial)" }} /> Completeness — branches with failures
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm font-mono">
              {completeness.map((c, i) => (
                <div key={i} className="px-3 py-2 rounded-md border flex items-center justify-between"
                  style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
                  <span>{c.district} → {c.block}</span>
                  <span style={{ color: "var(--failed)" }}>{c.failed} failed</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export */}
        <div className="card p-4" data-testid="export-panel">
          <div className="flex items-center gap-2 font-head font-semibold mb-3">
            <FileSpreadsheet size={16} style={{ color: "var(--success)" }} /> Export to Excel (.xlsx)
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {exportBtns.map((b) => (
              <a key={b.scope} href={api.exportUrl(b.scope)} download
                data-testid={b.scope === "all" ? "btn-export-excel" : `btn-export-${b.scope}`}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-all"
                style={b.primary
                  ? { background: "var(--success)", color: "#fff" }
                  : { background: "var(--bg-card)", border: "1px solid var(--border-accent)", color: "var(--text-primary)" }}>
                <Download size={15} /> {b.label}
              </a>
            ))}
            <span className="text-[11px] font-mono ml-2" style={{ color: "var(--text-muted)" }}>
              → GP_Contact_Data_{cfg?.financial_year || "2024-2025"}.xlsx
            </span>
          </div>
        </div>
      </main>

      <TestGpModal open={showTest} onClose={() => setShowTest(false)}
        fyLabel={cfg?.financial_year_label || "2024 - 2025"} onSaved={() => setTableTick((t) => t + 1)} />
      <AnalyzeDialog open={showAnalyze} onClose={() => setShowAnalyze(false)}
        loading={analyzeLoading} result={analyzeResult} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)}
        cfg={cfg?.crawler} onSaved={(crawler) => setCfg((c) => ({ ...c, crawler }))} />
    </div>
  );
}

export default App;
