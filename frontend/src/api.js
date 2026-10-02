import axios from "axios";

const BASE = `${process.env.REACT_APP_BACKEND_URL}/api`;

const client = axios.create({ baseURL: BASE, timeout: 120000 });

export const api = {
  config: () => client.get("/config").then((r) => r.data),
  financialYears: () => client.get("/financial-years").then((r) => r.data),
  setFinancialYear: (body) => client.post("/financial-year", body).then((r) => r.data),
  analyze: () => client.post("/analyze").then((r) => r.data),
  discover: (body) => client.post("/discover", body).then((r) => r.data),
  testGp: (body) => client.post("/test-gp", body).then((r) => r.data),
  start: (cfg) => client.post("/crawl/start", cfg || {}).then((r) => r.data),
  settings: (body) => client.post("/settings", body).then((r) => r.data),
  retryFailed: () => client.post("/crawl/retry-failed").then((r) => r.data),
  pause: () => client.post("/crawl/pause").then((r) => r.data),
  resume: () => client.post("/crawl/resume").then((r) => r.data),
  stop: () => client.post("/crawl/stop").then((r) => r.data),
  status: () => client.get("/crawl/status").then((r) => r.data),
  records: (params) => client.get("/records", { params }).then((r) => r.data),
  summary: () => client.get("/summary").then((r) => r.data),
  reset: () => client.post("/reset").then((r) => r.data),
  exportUrl: (scope) => `${BASE}/export?scope=${scope}`,
  logsUrl: () => `${BASE}/logs/download`,
};

export default api;
