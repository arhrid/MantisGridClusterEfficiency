const BASE = "/api";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

export const api = {
  summary: () => get("/summary"),
  waterfall: () => get("/waterfall"),
  wasteBreakdown: () => get("/waste-breakdown"),
  recommendations: () => get("/recommendations"),
  recommendationJobs: (id, limit = 100, offset = 0) =>
    get(`/recommendations/${id}/jobs?limit=${limit}&offset=${offset}`),
  jobDetail: (idJob) => get(`/jobs/${idJob}`),
  jobsByState: (state, limit = 200, offset = 0) => get(`/jobs?state=${state}&limit=${limit}&offset=${offset}`),
  nodes: () => get("/nodes"),
  arrays: () => get("/arrays"),
  users: () => get("/users"),
  userJobs: (idUser, limit = 100, offset = 0) =>
    get(`/users/${idUser}/jobs?limit=${limit}&offset=${offset}`),
};

export function fmtUsd(v, opts = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const { compact = true } = opts;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(v);
}

export function fmtNum(v, opts = {}) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const { compact = true, digits = 1 } = opts;
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(v);
}

export function fmtPct(v, digits = 1) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toFixed(digits)}%`;
}

export function fmtHours(sec) {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return "—";
  const h = sec / 3600;
  if (h < 1) return `${Math.round(sec / 60)}m`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
