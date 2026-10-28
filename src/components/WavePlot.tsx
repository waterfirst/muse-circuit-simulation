import { useEffect, useRef, useState } from "react";
import { LANES, plotWindow, type Series, type SeriesInfo } from "../lib/circuit";
import { drawPlot } from "../lib/plot";

interface Props {
  series: Series | null;
  info: SeriesInfo | null;
  enabled: Record<string, boolean>;
  onToggleLane: (lab: string) => void;
  marginReqLow?: number | null;
  lanes?: [string, string][];
  title?: string;
}

export default function WavePlot({ series, info, enabled, onToggleLane,
  marginReqLow = null, lanes = LANES, title = "파형 (프레임1 확대, 세로 분리)" }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(0); // 0 default, + zoom in, - zoom out
  const [shift, setShift] = useState(0); // pan steps
  useEffect(() => { setZoom(0); setShift(0); }, [series]);
  useEffect(() => {
    if (series && info && ref.current) {
      const w = plotWindow(series.t_us, info);
      if (info.frame_us) {
        // pixel: default to frame 2
        const F = info.frame_us;
        const span = (F / Math.pow(1.6, zoom));
        const c0 = F + F / 2 + shift * span * 0.25;
        const t0 = Math.max(0, c0 - span / 2), t1 = Math.min(info.TEND || 2 * F, c0 + span / 2);
        drawPlot(ref.current, series, info, enabled, marginReqLow, { lanes, t0, t1 });
      } else {
        const span = (w.t1 - w.t0) / Math.pow(1.6, zoom);
        const c0 = (w.t0 + w.t1) / 2 + shift * span * 0.25;
        drawPlot(ref.current, series, info, enabled, marginReqLow,
          { lanes, t0: c0 - span / 2, t1: c0 + span / 2 });
      }
    }
  });
  useEffect(() => {
    const h = () => {
      if (series && info && ref.current) {
        const w = plotWindow(series.t_us, info);
        drawPlot(ref.current, series, info, enabled, marginReqLow, { lanes, t0: w.t0, t1: w.t1 });
      }
    };
    window.addEventListener("resize", h);
    window.addEventListener("orientationchange", () => setTimeout(h, 300));
    return () => window.removeEventListener("resize", h);
  });
  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="chips" id="lanes">
        {lanes.map(([, lab]) => (
          <button key={lab} className={"chip" + (enabled[lab] ? " on" : "")}
            onClick={() => onToggleLane(lab)}>{lab}</button>
        ))}
      </div>
      <div className="chips">
        <button className="chip" onClick={() => setZoom((z) => z + 1)}>+ 확대</button>
        <button className="chip" onClick={() => setZoom((z) => z - 1)}>− 축소</button>
        <button className="chip" onClick={() => setShift((s) => s - 1)}>◀ 이전</button>
        <button className="chip" onClick={() => setShift((s) => s + 1)}>이후 ▶</button>
        <button className="chip" onClick={() => { setZoom(0); setShift(0); }}>리셋</button>
      </div>
      <canvas id="plot" className="plot" ref={ref}></canvas>
      <p className="note">신호 칩으로 표시 선택, 확대/축소/이전/이후로 시간창 이동. 전 레인 공유 시간축.</p>
    </div>
  );
}
