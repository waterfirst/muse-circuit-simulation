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
  ["FLM (원안)","-2.867 / 9.057","3.487 / 3.725 (전달 실패)","fail","FAIL"],
  ["VGH 상시온","6.821 / 8.509","7.953 / 8.018 (Low 없음)","fail","FAIL"],
  ["B (채택)","-9.496 / 9.923","-9.499 / 8.762","pass","PASS"],
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
      <div className="card"><h2>GW 7T 새 회로 시뮬레이션 (All PMOS, 6단 2프레임, 250kHz)</h2>
        <p className="note"><a href="#/">실험실로 돌아가기</a></p></div>
      <div className="card"><h2>회로도 (7T, C노드 없음, C1:A-B C2:Q-OUT)</h2><Schem7T /></div>
      <div className="card"><h2>OUT 요약 (6단)</h2>
        <table><tbody>
          <tr><th>OUT</th><th>min (V)</th><th>max (V)</th><th>판정</th></tr>
          {OUT_ROWS.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className="pass">{r[3]}</td></tr>))}
        </tbody></table></div>
      <div className="card"><h2>T2 게이트 비교 (원안 vs 개조)</h2>
        <table><tbody>
          <tr><th>T2.G</th><th>OUT1</th><th>OUT6</th><th>마진</th></tr>
          {T2_ROWS.map((r) => (<tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className={r[3]}>{r[4]}</td></tr>))}
        </tbody></table>
        <p className="note">원인: T2.G=FLM은 첫 프레임 스캔 펄스 때만 A를 당겨. 스캔 끝나면 A가 플로팅이라 후단으로 갈수록 B-QB 체인이 무너져. B나 Q로 물리면 스테이지 출력이 A 충전을 계속 끌고 가서 6단까지 살아.</p></div>
      <div className="card"><h2>파형 (T0-1H ~ T0+8H, H=4.0us)</h2><canvas id="plot" ref={ref}></canvas></div>
      <div className="card"><h2>실패 사례: FLM 8H 폭 (12T2C EM driver)</h2>
        <p className="note">증상: FLM high 약 66.56 us (8H). OUT1 high 66.75 us, OUT2 67.16 us가 FLM 폭과 일치. OUT3~OUT6 중복 펄스 3·4·5·7개. idle -0.76 ~ -1.22 V.</p>
        <p className="note">원인: 시작 신호가 8H 유지되어 Q/QB가 8H 유지. T9 pull-up 정상이라 OUT이 FLM 폭 그대로 출력, carry chain 연속 통과로 후단 중복 펄스. N_T1~N_T12 12개라 12T2C로 표기.</p>
        <p className="note">처방: FLM만 1H로 수정, 나머지는 손대지 말고 재실행.</p>
        <pre>{`* 1H = 8.3333 us
VFLM FLM 0 PWL(
+ 0.0000u   -9.5
+ 79.1667u  -9.5
+ 79.2709u   8.0
+ 87.5000u   8.0
+ 87.6042u  -9.5
+ 329.1667u -9.5
+ 329.2709u  8.0
+ 337.5000u  8.0
+ 337.6042u -9.5
+ 583.3333u -9.5
+ )`}</pre>
        <table><tbody>
          <tr><th>항목</th><th>기대값</th></tr>
          <tr><td>OUT1~OUT6 시작 간격</td><td>약 1H = 8.3333 us</td></tr>
          <tr><td>각 OUT high 폭</td><td>약 1H</td></tr>
          <tr><td>OUT3~OUT6 중복 펄스</td><td>제거</td></tr>
          <tr><td>High level</td><td>약 VGH = 8 V</td></tr>
        </tbody></table>
        <p className="note">T9/T10 진단 (idle이 -9.5 V까지 안 내려가면): VS_T9SENSE·VS_T10SENSE 삽입 후 em_diag.dat 저장. low 구간 |I_T10| 작음 → Q→T12→N2→T10 경로 문제. 둘 다 큼 → contention. T10 충분한데 미달 → 모델카드·D/G/S·부하 확인.</p>
        <p className="note">주의: C2=A-VGL이라 OUT 직접 bootstrap 없음. 구 GW의 C2=OUT-Q 진단을 그대로 적용 금지. BML·열화·C2 먼저 바꾸면 원인 섞임.</p></div>
    </div>
  );
}
