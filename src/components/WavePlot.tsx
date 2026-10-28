import { useEffect, useRef } from "react";
import { LANES, type Series, type SeriesInfo } from "../lib/circuit";
import { drawPlot } from "../lib/plot";

interface Props {
  series: Series | null;
  info: SeriesInfo | null;
  enabled: Record<string, boolean>;
  onToggleLane: (lab: string) => void;
  marginReqLow: number | null;
}

export default function WavePlot({ series, info, enabled, onToggleLane, marginReqLow }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (series && info && ref.current) drawPlot(ref.current, series, info, enabled, marginReqLow);
  });
  useEffect(() => {
    const h = () => {
      if (series && info && ref.current) drawPlot(ref.current, series, info, enabled, marginReqLow);
    };
    window.addEventListener("resize", h);
    window.addEventListener("orientationchange", () => setTimeout(h, 300));
    return () => window.removeEventListener("resize", h);
  });
  return (
    <div className="card">
      <h3>4. 파형 (프레임1 확대, 세로 분리)</h3>
      <div className="chips" id="lanes">
        {LANES.map(([, lab]) => (
          <button key={lab} className={"chip" + (enabled[lab] ? " on" : "")}
            onClick={() => onToggleLane(lab)}>{lab}</button>
        ))}
      </div>
      <canvas id="plot" className="plot" ref={ref}></canvas>
      <p className="note">스마트폰에서는 차 , 신호 칩을 눌러 보고 싶은 신호만 켜고 끄세요. 손가락으로 좌우 스크롤 대신 칩으로 선택하는 방식이라 그림이 깨지지 않습니다.</p>
    </div>
  );
}
