import { useEffect, useRef, useState } from "react";
import { STRESS_COEFS, type MarginStatus, type StressResult } from "../lib/circuit";
import { getMargin, postMargin, postStress } from "../lib/api";

export const DEG_HL = { background: "#fff3cd" };

// ---------------- stress estimator ----------------
export function StressPanel({ getDesc, onApply }: {
  getDesc: () => Record<string, unknown>;
  onApply: (table: { tft: string; dVth: number; ion: number; ioff: number; ss: number }[]) => void;
}) {
  const [temp, setTemp] = useState(85);
  const [hours, setHours] = useState(500);
  const [coefs, setCoefs] = useState<Record<string, number>>({ ...STRESS_COEFS });
  const [res, setRes] = useState<StressResult | null>(null);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true); setStatus("추정 중... (fresh 회로 1회 실행)");
    setRes(null);
    const r = await postStress({ desc: getDesc(), temp_C: temp, hours, coefs });
    setRunning(false);
    if (!r) { setStatus("데모 모드 (정적 페이지: 실시간 시뮬 불가)"); return; }
    if (!r.ok) { setStatus("중단됨: " + (r.errors || []).join("; ")); return; }
    setRes(r);
    setStatus(`완료 job=${r.job} (fresh 파형 기반, 창 ${r.window_us?.join("~")}us)`);
  };

  return (
    <div className="card">
      <h3>열화 추정 (고온 장기 스트레스 → ΔVth/Ion/Ioff/SS)</h3>
      <div className="row">
        <div><label>온도 (°C)</label>
          <input type="number" step={1} value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} /></div>
        <div><label>시간 (h)</label>
          <input type="number" step={10} value={hours} onChange={(e) => setHours(parseFloat(e.target.value))} /></div>
        <div><label>&nbsp;</label><button onClick={run} disabled={running}>스트레스 추정 실행</button></div>
      </div>
      <details>
        <summary>고급: BTS 법칙 계수 (합성 가정값)</summary>
        <div className="row">
          {Object.keys(STRESS_COEFS).map((k) => (
            <div key={k}><label>{k}</label>
              <input type="number" step={0.001} style={{ width: 90 }} value={coefs[k]}
                onChange={(e) => setCoefs((p) => ({ ...p, [k]: parseFloat(e.target.value) }))} /></div>
          ))}
        </div>
      </details>
      <p className="note">법칙: dVth=A·t^N·exp(Ea/k·(1/Tref−1/T))·bias.
        fresh 회로 파형에서 TFT별 on-duty·구동전압·off바이어스를 시간가중 평균으로 측정.
        드라이버는 시뮬 프레임 전체(스캔+홀드)가 실동작 1프레임이므로 별도 가중 없음. {res?.weight_note}</p>
      <span>{status}</span>
      {res?.table && (
        <div style={{ overflowX: "auto" }}><table><tbody>
          <tr><th>TFT</th><th>duty_on</th><th>Von</th><th>Voff</th><th>ΔVth</th><th>Ion</th><th>Ioff</th><th>SS</th></tr>
          {res.table.map((r) => (
            <tr key={r.tft}><td>{r.tft}</td><td>{r.duty_on}</td><td>{r.von_V}</td>
              <td>{r.voff_V}</td><td>{r.dVth}</td><td>{r.ion}</td>
              <td>{r.ioff}</td><td>{r.ss}</td></tr>
          ))}
        </tbody></table></div>
      )}
      {res?.table && (
        <div><button className="primary" onClick={() => onApply(res.table!)}>TFT 표에 적용 (ΔVth는 ±2V로 클램프)</button>
          <p className="note">{res.law}</p></div>
      )}
    </div>
  );
}

// ---------------- VGH x VGL margin map ----------------
function parseList(s: string): number[] {
  return s.split(/[,\s]+/).map((x) => parseFloat(x)).filter((x) => Number.isFinite(x));
}

function MarginGrid({ m, which, nominal }: {
  m: MarginStatus; which: "degraded" | "fresh"; nominal: { VGH: number; VGL: number };
}) {
  const grid = m.grids[which];
  if (!grid.length) return <p className="note">계산 중...</p>;
  let bi = 0, bj = 0, bd = 1e9;
  m.vgh.forEach((g, i) => m.vgl.forEach((l, j) => {
    const d = Math.abs(g - nominal.VGH) + Math.abs(l - nominal.VGL);
    if (d < bd) { bd = d; bi = i; bj = j; }
  }));
  const isDriver = m.kind !== "pixel";
  return (
    <div style={{ overflowX: "auto" }}>
      <p><b>{which === "degraded" ? "열화 회로" : "fresh 회로"}</b>
        {m.kind === "pixel" && m.ref_i_uA != null && (
          <span className="note"> 기준 fresh@nominal {m.ref_i_uA.toFixed(4)}uA</span>)}</p>
      <table><tbody>
        <tr><th>VGH\VGL</th>{m.vgl.map((l) => (<th key={l}>{l}</th>))}</tr>
        {m.vgh.map((g, i) => (
          <tr key={g}><th>{g}</th>
            {m.vgl.map((l, j) => {
              const c = grid[i]?.[j];
              const mark = i === bi && j === bj ? "2px solid #000" : undefined;
              if (!c) return <td key={l}>…</td>;
              if (!c.ok) return <td key={l} title={c.err} style={{ background: "#ddd", outline: mark }}>ERR</td>;
              if (isDriver)
                return <td key={l} className={c.pass ? "pass" : "fail"}
                  style={{ outline: mark }} title={`${c.job} nfail=${c.nfail}`}>{c.pass ? "P" : "F"}</td>;
              const pct = c.pct ?? 0;
              const bg = Math.abs(pct) < 5 ? "#d4edda" : Math.abs(pct) < 20 ? "#fff3cd" : "#f8d7da";
              return <td key={l} style={{ background: bg, outline: mark }}
                title={`${c.job} ${c.i_uA}uA`}>{pct > 0 ? "+" : ""}{pct}%</td>;
            })}
          </tr>
        ))}
      </tbody></table>
    </div>
  );
}

export function MarginPanel({ getDesc, kind }: {
  getDesc: () => Record<string, unknown>; kind: "driver" | "pixel";
}) {
  const [vghT, setVghT] = useState("7, 8, 9");
  const [vglT, setVglT] = useState("-11, -9.5, -8");
  const [m, setM] = useState<MarginStatus | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const run = async () => {
    const vgh = parseList(vghT), vgl = parseList(vglT);
    if (vgh.length < 2 || vgl.length < 2) { setStatus("VGH/VGL 각 2개 이상 입력"); return; }
    setM(null); setStatus("마진맵 시작...");
    const s = await postMargin({ desc: getDesc(), vgh, vgl });
    if (!s) { setStatus("데모 모드 (정적 페이지: 실시간 시뮬 불가)"); return; }
    if (!s.ok) { setStatus("중단됨: " + (s.errors || []).join("; ")); return; }
    setStatus(`진행 중... (총 ${s.total}셀)`);
    if (timer.current) clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      const st = await getMargin(s.margin_job!);
      if (!st) { setStatus("폴링 실패 (백엔드 확인)"); return; }
      setM(st);
      setStatus(st.state === "done" ? `완료 ${st.margin_job}` :
        st.state === "error" ? `오류: ${st.error}` :
        `진행 ${st.done}/${st.total}`);
      if (st.state !== "running" && timer.current) {
        clearInterval(timer.current); timer.current = null;
      }
    }, 2000);
  };

  const d = getDesc() as { VGH?: number; vgh?: number; VGL?: number; vgl?: number };
  const nominal = { VGH: Number(d.VGH ?? d.vgh ?? 8), VGL: Number(d.VGL ?? d.vgl ?? -9.5) };

  return (
    <div className="card">
      <h3>VGH × VGL 마진맵 ({kind === "driver" ? "판정 P/F" : "발광전류 변화율 %"})</h3>
      <div className="row">
        <div><label>VGH 목록 (V)</label>
          <input style={{ width: 160 }} value={vghT} onChange={(e) => setVghT(e.target.value)} /></div>
        <div><label>VGL 목록 (V)</label>
          <input style={{ width: 160 }} value={vglT} onChange={(e) => setVglT(e.target.value)} /></div>
        <div><label>&nbsp;</label><button onClick={run}>마진맵 실행 (백그라운드)</button></div>
      </div>
      <p className="note">열화(현재 TFT표+온도)와 fresh를 나란히 스윕. 검정 테두리 = 현재 설정과 가장 가까운 셀.
        셀에 마우스를 올리면 job 번호. {kind === "pixel" ? "변화율 기준 = fresh@nominal 전류." : ""}</p>
      <span>{status}</span>
      {m && m.done > 0 && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <MarginGrid m={m} which="degraded" nominal={nominal} />
          <MarginGrid m={m} which="fresh" nominal={nominal} />
        </div>
      )}
    </div>
  );
}
