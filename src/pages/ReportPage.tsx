import { useEffect, useRef, useState } from "react";
import Schem7T from "../components/Schem7T";
import gw7t from "../data/gw7t.json";
import type { Series, SeriesInfo } from "../lib/circuit";
import { drawPlot } from "../lib/plot";
import { COLORS } from "../lib/circuit";

const SERIES = gw7t.series as Series;
const INFO = gw7t.info as SeriesInfo;
const GLANES = gw7t.lanes as [string, string, string][];

const OUT_ROWS = [
  ["OUT1","-9.496","9.923","pass"],["OUT2","-9.495","8.972","pass"],["OUT3","-9.496","8.749","pass"],
  ["OUT4","-9.496","8.703","pass"],["OUT5","-9.496","8.737","pass"],["OUT6","-9.499","8.762","pass"],
];
const T2_ROWS = [
  ["FLM (orig)","-2.867 / 9.057","3.487 / 3.725 (no transfer)","fail","FAIL"],
  ["VGH always-on","6.821 / 8.509","7.953 / 8.018 (no low)","fail","FAIL"],
  ["B (adopted)","-9.496 / 9.923","-9.499 / 8.762","pass","PASS"],
  ["Q","-9.496 / 9.942","-9.499 / 8.733","pass","PASS"],
];

export default function ReportPage() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [enabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GLANES.map(([, lab]) => [lab, true])));
  useEffect(() => {
    // reuse the lane plotter with the report's own lane list/colors
    const el = ref.current;
    if (!el) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const cssW = el.clientWidth || el.parentElement?.clientWidth || 360;
    const laneH = 64, top = 8;
    const cssH = GLANES.length * laneH + 30;
    el.width = Math.round(cssW * dpr); el.height = Math.round(cssH * dpr);
    el.style.height = cssH + "px";
    const ctx = el.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.font = "11px sans-serif";
    const H = INFO.H || 4, t0 = INFO.T0 - 1 * H, t1 = INFO.T0 + 8 * H;
    const t = SERIES.t_us;
    let i0 = 0, i1 = t.length - 1;
    for (let i = 0; i < t.length; i++) { if (t[i] < t0) i0 = i; if (t[i] <= t1) i1 = i; }
    GLANES.forEach(([key, lab, col], li) => {
      const y0 = top + li * laneH, left = 44, Wd = cssW - left - 8;
      ctx.strokeStyle = "#ddd"; ctx.strokeRect(left, y0 + 2, Wd, laneH - 4);
      ctx.fillStyle = "#000"; ctx.fillText(lab, 4, y0 + laneH / 2);
      let mn = 1e9, mx = -1e9;
      for (let i = i0; i <= i1; i++) { const v = SERIES[key][i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      if (mx - mn < 0.5) { mn -= 0.25; mx += 0.25; }
      if (lab.startsWith("OUT")) {
        const y = y0 + 2 + (laneH - 4) * (1 - (-6.0 - mn) / (mx - mn));
        if (y >= y0 && y <= y0 + laneH) {
          ctx.strokeStyle = "#c00"; ctx.setLineDash([4, 3]); ctx.beginPath();
          ctx.moveTo(left, y); ctx.lineTo(left + Wd, y); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = "#c00"; ctx.fillText("spec -6", left + Wd - 48, y - 3);
        }
      }
      ctx.strokeStyle = col || COLORS[lab] || "#00c"; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let i = i0; i <= i1; i++) {
        const x = left + Wd * (t[i] - t0) / (t1 - t0);
        const y = y0 + 2 + (laneH - 4) * (1 - (SERIES[key][i] - mn) / (mx - mn));
        if (i === i0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = "#555"; ctx.fillText(mn.toFixed(1) + ".." + mx.toFixed(1), left + 3, y0 + 13);
    });
    ctx.fillStyle = "#000";
    ctx.fillText(`T0+${((t0 - INFO.T0) / H).toFixed(1)}H ~ T0+${((t1 - INFO.T0) / H).toFixed(1)}H`, 44, cssH - 6);
    void drawPlot;
  }, [enabled]);
  return (
    <div>
      <div className="card"><h2>GW 7T new circuit simulation (all PMOS, 6 stages, 2 frames, 250kHz)</h2>
        <p className="note">Synthetic-model ngspice evidence, not measured silicon. <a href="#/drv">Driver lab</a> · <a href="#/pixel">Pixel lab</a></p></div>
      <div className="card"><h2>Schematic (7T, no C node, C1:A-B C2:Q-OUT)</h2><Schem7T /></div>
      <div className="card"><h2>OUT summary (6 stages)</h2>
        <table><tbody>
          <tr><th>OUT</th><th>min (V)</th><th>max (V)</th><th>Verdict</th></tr>
          {OUT_ROWS.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className="pass">{r[3]}</td></tr>))}
        </tbody></table></div>
      <div className="card"><h2>T2 gate comparison (original vs rework)</h2>
        <table><tbody>
          <tr><th>T2.G</th><th>OUT1</th><th>OUT6</th><th>Margin</th></tr>
          {T2_ROWS.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className={r[3]}>{r[4]}</td></tr>))}
        </tbody></table>
        <p className="note">Cause: T2.G=FLM pulls A only during the first-frame scan pulse. After scan, A floats and the B-QB chain collapses downstream. Tying to B or Q keeps stage output driving A charge through all 6 stages.</p></div>
      <div className="card"><h2>Waveforms (T0-1H to T0+8H, H=4.0us)</h2><canvas id="plot" ref={ref}></canvas></div>
    </div>
  );
}
