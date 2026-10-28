import type { PassFail, Series, SeriesInfo, SimDesc } from "./circuit";

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
