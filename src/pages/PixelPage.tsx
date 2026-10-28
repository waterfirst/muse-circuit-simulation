import { useState } from "react";
import { DEFAULT_PIXEL, DEFAULT_PTFT, PIXEL_LANES, P_NETS, P_TFTS,
  type Pin, type PixelParams, type PNet, type PTft, type PTftMap,
  type Series, type SeriesInfo } from "../lib/circuit";
import { postPixel } from "../lib/api";
import WavePlot from "../components/WavePlot";
import PixelSchem from "../components/PixelSchem";
import { DEG_HL, MarginPanel, StressPanel } from "../components/Aging";

type Sig = "GI" | "GC" | "GW" | "EM" | "GO";
const SIGS: Sig[] = ["GI", "GC", "GW", "EM", "GO"];

export default function PixelPage() {
  const [p, setP] = useState<PixelParams>(DEFAULT_PIXEL);
  const [tft, setTft] = useState<PTftMap>(DEFAULT_PTFT);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PIXEL_LANES.map(([, lab]) => [lab, true])));
  const [status, setStatus] = useState("실행 전");
  const [errs, setErrs] = useState<string[]>([]);
  const [result, setResult] = useState<{ i_emission_uA?: number; i_frame_avg_uA?: number;
    ng_after_gc_V?: number; data_V?: number } | null>(null);
  const [dvth, setDvth] = useState<{ dv: number; i: number; job: string }[]>([]);
  const [series, setSeries] = useState<Series | null>(null);
  const [info, setInfo] = useState<SeriesInfo | null>(null);
  const [cir, setCir] = useState("");
  const [job, setJob] = useState("");
  const [running, setRunning] = useState(false);

  const set = <K extends keyof PixelParams>(k: K, v: PixelParams[K]) =>
    setP((prev) => ({ ...prev, [k]: v }));
  const setWin = (s: Sig, k: 0 | 1, v: number) =>
    setP((prev) => {
      const t = { ...prev.timing };
      t[s] = k === 0 ? [v, t[s][1]] : [t[s][0], v];
      return { ...prev, timing: t };
    });

  const buildDesc = (data: number, t1dv: number) => {
    const t: Record<string, unknown> = {};
    for (const n of P_TFTS)
      t[n] = { ...tft[n], dVth: n === "T1" ? t1dv : tft[n].dVth };
    return { kind: "pixel", ...p, DATA: data, timing: p.timing, tft: t };
  };

  const run = async (data: number, t1dv = 0) => {
    setRunning(true);
    setStatus(`실행 중... (DATA=${data}V, T1 ΔVth=${t1dv}V)`);
    setErrs([]); setResult(null);
    const j = await postPixel(buildDesc(data, t1dv));
    setRunning(false);
    if (!j) {
      setStatus("서버에 닿지 않음 (127.0.0.1:8768 확인)");
      setErrs(["백엔드 연결 실패"]); return null;
    }
    if (!j.ok) {
      setStatus("중단됨 (위 오류 확인)");
      setErrs(j.errors || []); return null;
    }
    setStatus(`완료 job=${j.job}`);
    setJob(j.job || "");
    setCir(j.cir || "");
    if (j.result) setResult(j.result);
    if (j.series && j.info) {
      setSeries(j.series);
      setInfo({ ...j.info, T0: 0, frame_us: (j.info.frame_us as number) ?? 1e6 / p.frame_hz,
        TEND: (j.info.TEND as number) ?? 0 });
    }
    return j;
  };

  const runDvthCheck = async () => {
    setDvth([]);
    const rows: { dv: number; i: number; job: string }[] = [];
    for (const dv of [-0.2, 0, 0.2]) {
      const j = await run(p.DATA, dv);
      if (j?.result?.i_emission_uA != null)
        rows.push({ dv, i: j.result.i_emission_uA, job: j.job || "" });
      else return;
    }
    setDvth(rows);
  };

  const downloadCir = () => {
    const blob = new Blob([cir], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${job || "pixel"}.cir`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const num = (lab: string, v: number, fn: (v: number) => void, step = 0.1) => (
    <div><label>{lab}</label>
      <input type="number" step={step} value={v} onChange={(e) => fn(parseFloat(e.target.value))} /></div>
  );
  const frameUs = 1e6 / (p.frame_hz || 120);

  return (
    <div className="wrap">
      <h1>8T1C LTPO 픽셀</h1>
      <p className="note">T1 구동(P) T2 기록(P,GW) T3 보상(N,GC) T4 게이트초기화(N,GI)
        T5/T6 발광(P,EM) T7 애노드초기화(P) T8 온바이어스(P,GO).
        모든 치수·용량·타이밍은 합성 가정값. GI/GC는 active-high, GW/EM/GO는 active-low.</p>
      <div className="card">
        <h3>1. 전원 / 타이밍 (frame {frameUs.toFixed(0)}us @ {p.frame_hz}Hz)</h3>
        <div className="row">
          {num("DATA (V)", p.DATA, (v) => set("DATA", v))}
          {num("ELVDD (V)", p.ELVDD, (v) => set("ELVDD", v))}
          {num("ELVSS (V)", p.ELVSS, (v) => set("ELVSS", v))}
          {num("VINT (V)", p.VINT, (v) => set("VINT", v))}
          {num("VOBS (V)", p.VOBS, (v) => set("VOBS", v))}
          {num("스캔 VGH (V)", p.VGH, (v) => set("VGH", v))}
          {num("스캔 VGL (V)", p.VGL, (v) => set("VGL", v))}
          {num("프레임 (Hz)", p.frame_hz, (v) => set("frame_hz", v), 1)}
          {num("Cst (pF)", p.Cst_pf, (v) => set("Cst_pf", v))}
          {num("C_OLED (pF)", p.Coled_pf, (v) => set("Coled_pf", v))}
          {num("P VT0 (V)", p.VT0_P, (v) => set("VT0_P", v))}
          {num("N VT0 (V)", p.VT0_N, (v) => set("VT0_N", v))}
          {num("온도 (°C)", p.temp_C, (v) => set("temp_C", v), 1)}
        </div>
        <table><tbody>
          <tr><th>신호</th><th>시작 (us)</th><th>끝 (us)</th><th>극성</th></tr>
          {SIGS.map((s) => (
            <tr key={s}><td>{s}</td>
              <td><input type="number" step={1} value={p.timing[s][0]}
                onChange={(e) => setWin(s, 0, parseFloat(e.target.value))} /></td>
              <td><input type="number" step={1} value={p.timing[s][1]}
                onChange={(e) => setWin(s, 1, parseFloat(e.target.value))} /></td>
              <td>{s === "GI" || s === "GC" ? "H-active" : "L-active"}</td></tr>
          ))}
        </tbody></table>
      </div>
      <div className="card">
        <h3>2. 회로도 (P 버블 / N 무버블, OLED 다이오드)</h3>
        <PixelSchem tft={tft} cst={p.Cst_pf} coled={p.Coled_pf} />
        <p className="note">배선·단자 라벨은 아래 TFT 표에서 직접 그리므로 넷리스트와 항상 일치합니다.</p>
      </div>
      <div className="card">
        <h3>3. TFT (타입/G/S/D/W/L/ΔVth/Ion/Ioff/SS)</h3>
        <div style={{ overflowX: "auto" }}><table><tbody>
          <tr><th>TFT</th><th>타입</th><th>G</th><th>S</th><th>D</th><th>W</th><th>L</th>
            <th>ΔVth</th><th>Ion×</th><th>Ioff×</th><th>SS×</th></tr>
          {P_TFTS.map((t: PTft) => (
            <tr key={t}><td>{t}</td>
              <td><select value={tft[t].type}
                onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], type: e.target.value as "P" | "N" } }))}>
                <option value="P">P</option><option value="N">N</option></select></td>
              {(["G", "S", "D"] as Pin[]).map((pin) => (
                <td key={pin}><select value={tft[t][pin]}
                  onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], [pin]: e.target.value as PNet } }))}>
                  {P_NETS.map((n) => (<option key={n} value={n}>{n}</option>))}</select></td>
              ))}
              <td><input type="number" step={0.5} style={{ width: 60 }} value={tft[t].W}
                onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], W: parseFloat(e.target.value) } }))} /></td>
              <td><input type="number" step={0.5} style={{ width: 60 }} value={tft[t].L}
                onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], L: parseFloat(e.target.value) } }))} /></td>
              <td style={tft[t].dVth !== 0 ? DEG_HL : undefined}>
                <input type="number" step={0.1} style={{ width: 64 }} value={tft[t].dVth}
                  onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], dVth: parseFloat(e.target.value) } }))} /></td>
              {(["ion", "ioff", "ss"] as const).map((k) => (
                <td key={k} style={tft[t][k] !== 1 ? DEG_HL : undefined}>
                  <input type="number" step={0.05} style={{ width: 62 }} value={tft[t][k]}
                    onChange={(e) => setTft((p) => ({ ...p, [t]: { ...p[t], [k]: parseFloat(e.target.value) } }))} />
                </td>
              ))}
            </tr>
          ))}
        </tbody></table></div>
        <p className="note">fresh(0/1/1/1)와 다른 열화 셀은 노란색.</p>
      </div>
      <div className="card">
        <h3>4. 실행</h3>
        <button className="primary" onClick={() => run(p.DATA, tft.T1.dVth)} disabled={running}>시뮬레이션 실행</button>
        <button onClick={runDvthCheck} disabled={running}>Vth 보상 확인 (T1 ΔVth −0.2/0/+0.2V)</button>
        <span> {status}</span>
        <div id="errs" className="msg">{errs.map((e, i) => (<div key={i}>- {e}</div>))}</div>
        {result && (
          <table><tbody>
            <tr><th>발광중 전류 (uA)</th><th>프레임 평균 (uA)</th><th>GC 후 NG (V)</th><th>DATA (V)</th></tr>
            <tr><td>{result.i_emission_uA}</td><td>{result.i_frame_avg_uA}</td>
              <td>{result.ng_after_gc_V}</td><td>{result.data_V}</td></tr>
          </tbody></table>
        )}
        {dvth.length === 3 && (
          <div>
            <table><tbody>
              <tr><th>T1 ΔVth (V)</th><th>발광 전류 (uA)</th><th>job</th></tr>
              {dvth.map((r) => (<tr key={r.dv}><td>{r.dv}</td><td>{r.i}</td><td>{r.job}</td></tr>))}
            </tbody></table>
            <p className="note">보상 양호 기준: ΔVth ±0.2V에도 발광 전류가 거의 변하지 않아야 한다
              (다이오드 보상 후 NG가 Vth 이동을 상쇄). 측정 변화율: {
              (((Math.max(...dvth.map((r) => r.i)) - Math.min(...dvth.map((r) => r.i))) /
                (dvth[1]?.i || 1)) * 100).toFixed(2)}%.</p>
          </div>
        )}
      </div>
      <StressPanel
        getDesc={() => buildDesc(p.DATA, tft.T1.dVth) as unknown as Record<string, unknown>}
        onApply={(rows) => setTft((prev) => {
          const n = { ...prev };
          for (const r of rows) {
            const t = r.tft as PTft;
            if (n[t]) n[t] = { ...n[t],
              dVth: Math.max(-2, Math.min(2, r.dVth)),
              ion: r.ion, ioff: r.ioff, ss: r.ss };
          }
          return n;
        })} />
      <MarginPanel
        getDesc={() => buildDesc(p.DATA, tft.T1.dVth) as unknown as Record<string, unknown>}
        kind="pixel" />
      {series && info && (
        <WavePlot series={series} info={info} enabled={enabled} lanes={PIXEL_LANES}
          title="5. 파형 (frame2, 제어/노드/OLED전류)"
          onToggleLane={(lab) => setEnabled((p) => ({ ...p, [lab]: !p[lab] }))} />
      )}
      {cir && (
        <div className="card">
          <h3>6. 넷리스트</h3>
          <button onClick={downloadCir}>.cir 다운로드</button>
          <span className="note"> job={job} · server/runs/{job}/job.cir</span>
          <pre>{cir}</pre>
        </div>
      )}
    </div>
  );
}
