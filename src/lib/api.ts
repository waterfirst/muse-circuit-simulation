import type { MarginStatus, PassFail, Series, SeriesInfo, SimDesc, StressResult } from "./circuit";

async function post(path: string, body: unknown, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(BACKENDS[0] + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(to);
  }
}

export async function postPixel(desc: unknown, timeoutMs = 280000): Promise<SimResponse | null> {
  for (const b of BACKENDS) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), timeoutMs);
      let r: Response;
      try {
        r = await fetch(b + "/api/pixel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(desc),
          signal: ctl.signal,
        });
      } finally {
        clearTimeout(to);
      }
      if (r.ok || r.status === 422) return (await r.json()) as SimResponse;
    } catch {
      /* next backend */
    }
  }
  return null;
}

export const BACKENDS = [
  "http://127.0.0.1:8768",
];

export interface SimResponse {
  ok: boolean;
  job?: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  summary?: unknown;
  margin?: { req_low?: number; [k: string]: unknown } | null;
  timing?: { H_us?: number; [k: string]: unknown };
  rails?: unknown;
  series?: Series;
  info?: SeriesInfo;
  passfail?: PassFail;
  cir?: string;
  result?: { i_emission_uA?: number; i_frame_avg_uA?: number; ng_after_gc_V?: number; data_V?: number };
}

export async function postStress(payload: unknown, timeoutMs = 280000): Promise<StressResult | null> {
  try {
    const r = await post("/api/stress", payload, timeoutMs);
    if (r.ok || r.status === 422) return (await r.json()) as StressResult;
  } catch { /* unreachable */ }
  return null;
}

export interface MarginStart { ok: boolean; margin_job?: string; total?: number; errors?: string[] }

export async function postMargin(payload: unknown, timeoutMs = 30000): Promise<MarginStart | null> {
  try {
    const r = await post("/api/margin", payload, timeoutMs);
    if (r.ok || r.status === 422) return (await r.json()) as MarginStart;
  } catch { /* unreachable */ }
  return null;
}

export async function getMargin(id: string, timeoutMs = 30000): Promise<MarginStatus | null> {
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const r = await fetch(BACKENDS[0] + "/api/margin?id=" + encodeURIComponent(id),
        { signal: ctl.signal });
      if (r.ok) return (await r.json()) as MarginStatus;
    } finally {
      clearTimeout(to);
    }
  } catch { /* unreachable */ }
  return null;
}

export async function tryBackend(desc: SimDesc, timeoutMs = 280000): Promise<SimResponse | null> {
  for (const b of BACKENDS) {
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), timeoutMs);
      let r: Response;
      try {
        r = await fetch(b + "/api/sim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(desc),
          signal: ctl.signal,
        });
      } finally {
        clearTimeout(to);
      }
      if (r.ok || r.status === 422) return (await r.json()) as SimResponse;
    } catch {
      /* next backend */
    }
  }
  return null;
}
