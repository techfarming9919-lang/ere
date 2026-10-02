import React, { useEffect, useState } from "react";
import { Modal, Btn } from "./ui";
import { Settings as SettingsIcon, Eye, Clock, Gauge } from "lucide-react";
import api from "../api";

export default function SettingsModal({ open, onClose, cfg, onSaved }) {
  const [form, setForm] = useState({
    headless: true, profile_timeout_s: 60, delay_min_ms: 500, delay_max_ms: 1500, max_retries: 3,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open && cfg) setForm((f) => ({ ...f, ...cfg }));
    setSaved(false);
  }, [open, cfg]);

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.settings(form);
      setSaved(true);
      onSaved && onSaved(res.crawler);
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Crawler Settings" testid="settings-modal">
      <div className="space-y-5">
        <label className="flex items-center justify-between gap-4 p-3 rounded-md border cursor-pointer"
          style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
          <div className="flex items-start gap-3">
            <Eye size={18} style={{ color: "var(--brand)" }} className="mt-0.5" />
            <div>
              <div className="font-semibold text-sm">Show browser window (headful)</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Government site often blocks hidden browsers. Turn this ON to watch the crawl and improve reliability.
              </div>
            </div>
          </div>
          <input type="checkbox" data-testid="settings-headful-toggle"
            checked={!form.headless}
            onChange={(e) => upd("headless", !e.target.checked)}
            className="w-5 h-5 accent-blue-500" />
        </label>

        <Field icon={Clock} label="Profile timeout (seconds)" hint="Increase on slow connections (e.g. 90–120).">
          <input type="number" min={15} max={300} data-testid="settings-timeout"
            value={form.profile_timeout_s}
            onChange={(e) => upd("profile_timeout_s", parseInt(e.target.value || "60", 10))}
            className="w-24 text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
            style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
        </Field>

        <Field icon={Gauge} label="Delay between GPs (ms)" hint="Be polite to the server. min / max.">
          <div className="flex items-center gap-2">
            <input type="number" min={0} data-testid="settings-delay-min" value={form.delay_min_ms}
              onChange={(e) => upd("delay_min_ms", parseInt(e.target.value || "0", 10))}
              className="w-20 text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
              style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
            <span style={{ color: "var(--text-muted)" }}>–</span>
            <input type="number" min={0} data-testid="settings-delay-max" value={form.delay_max_ms}
              onChange={(e) => upd("delay_max_ms", parseInt(e.target.value || "0", 10))}
              className="w-20 text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
              style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
          </div>
        </Field>

        <Field icon={SettingsIcon} label="Max retries per GP" hint="Failed GP retried this many times with backoff.">
          <input type="number" min={1} max={10} data-testid="settings-retries" value={form.max_retries}
            onChange={(e) => upd("max_retries", parseInt(e.target.value || "3", 10))}
            className="w-20 text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none"
            style={{ borderColor: "var(--border-accent)", color: "var(--text-primary)" }} />
        </Field>

        <div className="flex items-center justify-end gap-3 pt-1">
          {saved && <span className="text-xs" style={{ color: "var(--success)" }}>Saved ✓</span>}
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
          <Btn variant="primary" loading={saving} onClick={save} data-testid="btn-save-settings">Save Settings</Btn>
        </div>
      </div>
    </Modal>
  );
}

function Field({ icon: Icon, label, hint, children }) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-md border"
      style={{ borderColor: "var(--border-color)", background: "var(--bg-main)" }}>
      <div className="flex items-start gap-3">
        <Icon size={18} style={{ color: "var(--brand)" }} className="mt-0.5" />
        <div>
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{hint}</div>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
