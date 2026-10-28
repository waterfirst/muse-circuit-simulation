import { COLORS, LANES, plotWindow, axisLabel, type Series, type SeriesInfo } from "./circuit";

/** Canvas lane plot. Same geometry as the vanilla drawPlot. */
export function drawPlot(
  cv: HTMLCanvasElement,
  s: Series,
  info: SeriesInfo,
  enabled: Record<string, boolean>,
  marginReqLow: number | null = null,
): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cssW = cv.clientWidth || cv.parentElement?.clientWidth || 360;
  const active = LANES.filter(([, lab]) => enabled[lab] && s[LANES.find((l) => l[1] === lab)![0]]);
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
  const { H, t0, t1, i0, i1 } = plotWindow(t, info);
  ctx.font = "11px sans-serif";
  const laneMinMax = (key: string): [number, number] => {
    let mn = 1e9, mx = -1e9;
    for (let i = i0; i <= i1; i++) { const v = s[key][i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx - mn < 0.5) { mn -= 0.25; mx += 0.25; }
    return [mn, mx];
  };
  active.forEach(([key, lab], li) => {
    const y0 = top + li * laneH;
    const left = 44, Wd = cssW - left - 8;
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
    ctx.fillStyle = "#555"; ctx.fillText(mn.toFixed(1) + ".." + mx.toFixed(1), left + 3, y0 + 13);
  });
  if (marginReqLow != null) {
    active.forEach(([key, lab], li) => {
      if (!lab.startsWith("OUT")) return;
      const y0 = top + li * laneH;
      const left = 44, Wd = cssW - left - 8;
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
  ctx.fillText(axisLabel(info, H, t0, t1), 44, cssH - 6);
}
