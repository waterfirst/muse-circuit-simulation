import { COLORS, LANES, plotWindow, axisLabel, type Series, type SeriesInfo } from "./circuit";

export interface PlotOpts {
  lanes?: [string, string][];
  t0?: number; // explicit window (zoom); defaults to plotWindow
  t1?: number;
  unit?: string; // axis note, e.g. pixel frame
}

/** Canvas lane plot, stacked lanes on one shared time axis. */
export function drawPlot(
  cv: HTMLCanvasElement,
  s: Series,
  info: SeriesInfo,
  enabled: Record<string, boolean>,
  marginReqLow: number | null = null,
  opts: PlotOpts = {},
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = cv.clientWidth || cv.parentElement?.clientWidth || 360;
  const lanes = opts.lanes || LANES;
  const active = lanes.filter(([, lab]) => enabled[lab] && s[lanes.find((l) => l[1] === lab)![0]]);
  const laneH = 64;
  const top = 8, bottom = 22;
  const cssH = Math.max(active.length * laneH + top + bottom, 200);
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  cv.style.height = cssH + "px";
  const ctx = cv.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);
  const t = s.t_us;
  const w = plotWindow(t, info);
  const H = w.H;
  const t0 = opts.t0 ?? w.t0, t1 = opts.t1 ?? w.t1;
  let i0 = 0, i1 = t.length - 1;
  for (let i = 0; i < t.length; i++) { if (t[i] < t0) i0 = i; if (t[i] <= t1) i1 = i; }
  ctx.font = "11px sans-serif";
  const laneMinMax = (key: string): [number, number] => {
    let mn = 1e9, mx = -1e9;
    for (let i = i0; i <= i1; i++) { const v = s[key][i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn < 0.5 && key !== "i(oled)") { mn -= 0.25; mx += 0.25; }
    if (key === "i(oled)" && mx - mn < 1e-9) { mn -= 0.1; mx += 0.1; }
    return [mn, mx];
  };
  // shared time grid
  const left = 44, Wd = cssW - left - 8;
  active.forEach(([key, lab], li) => {
    const y0 = top + li * laneH;
    ctx.strokeStyle = "#ddd"; ctx.strokeRect(left, y0 + 2, Wd, laneH - 4);
    ctx.fillStyle = "#000"; ctx.fillText(lab, 4, y0 + laneH / 2);
    const [mn, mx] = laneMinMax(key);
    ctx.strokeStyle = COLORS[lab] || "#00c"; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = i0; i <= i1; i++) {
      const x = left + Wd * (s.t_us[i] - t0) / (t1 - t0);
      const y = y0 + 2 + (laneH - 4) * (1 - (s[key][i] - mn) / (mx - mn));
      if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillStyle = "#555";
    const unit = key === "i(oled)" ? "uA" : "V";
    ctx.fillText(mn.toFixed(2) + ".." + mx.toFixed(2) + unit, left + 3, y0 + 13);
  });
  if (marginReqLow != null) {
    active.forEach(([key, lab], li) => {
      if (!lab.startsWith("OUT")) return;
      const y0 = top + li * laneH;
      const [mn, mx] = laneMinMax(key);
      const y = y0 + 2 + (laneH - 4) * (1 - (marginReqLow - mn) / (mx - mn));
      if (y >= y0 && y <= y0 + laneH) {
        ctx.strokeStyle = "#c00"; ctx.setLineDash([4, 3]); ctx.beginPath();
        ctx.moveTo(left, y); ctx.lineTo(left + Wd, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = "#c00"; ctx.fillText("spec " + marginReqLow.toFixed(1), left + Wd - 52, y - 3);
      }
    });
  }
  ctx.fillStyle = "#000";
  const base = info.frame_us
    ? `frame2 window ${t0.toFixed(1)} ~ ${t1.toFixed(1)} us`
    : axisLabel(info, H, t0, t1);
  ctx.fillText(opts.unit ? `${base} [${opts.unit}]` : base, 44, cssH - 6);
}
