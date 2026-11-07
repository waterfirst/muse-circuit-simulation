import { useEffect, useRef, useState } from "react";

interface Result {
  ok: boolean; errors?: string[]; job?: string; deck_url?: string;
  parameters?: { t9_width_um: number; c3_pf: number };
  series?: { time_us: number[]; outputs: Record<string, number[]> };
}

export default function GbCandidatePage() {
  const [width, setWidth] = useState("112");
  const [cap, setCap] = useState("1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [windowStart, setWindowStart] = useState(150);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const valid = Number.isFinite(+width) && +width >= 4 && +width <= 512 &&
    Number.isFinite(+cap) && +cap >= 0.05 && +cap <= 5;
  const change = (w: string, c: string) => { setWidth(w); setCap(c); setResult(null); setError(""); };
  async function run() {
    if (busy || !valid) return;
    setBusy(true); setError(""); setResult(null);
    const ctl = new AbortController(); abort.current = ctl;
    const timer = setTimeout(() => ctl.abort(), 200000);
    try {
      // Exactly one destination and one POST: never silently retry a simulation.
      const localDev = ["localhost", "127.0.0.1"].includes(location.hostname) && ["5173", "4173"].includes(location.port);
      const base = localDev ? "http://127.0.0.1:8768/" : new URL(".", document.baseURI).href;
      const response = await fetch(base + "api/gb-candidate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t9_width_um: +width, c3_pf: +cap }), signal: ctl.signal,
      });
      if (!response.ok && response.status !== 422) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as Result;
      if (!data.ok || !data.series || !data.parameters) throw new Error(data.errors?.join("; ") || "결과 데이터가 없습니다.");
      if (data.deck_url) data.deck_url = new URL(data.deck_url.replace(/^\//, ""), base).href;
      setResult(data);
    } catch (e) {
      if (!ctl.signal.aborted) setError(`실행하지 못했습니다: ${e instanceof Error ? e.message : String(e)}. Python/ngspice 서버와 새 API 배포 여부를 확인하세요. 데모 파형으로 대체하지 않습니다.`);
      else setError("요청 대기가 끝났습니다. 서버에서는 계산이 계속될 수 있으므로 확인 후 다시 실행하세요.");
    } finally { clearTimeout(timer); setBusy(false); }
  }
  return <main className="card">
    <h2>GB 16T 합성 수정 후보 실험</h2>
    <p role="note"><strong>원본 회로의 검증 결과가 아닙니다.</strong> 연결·부하·타이밍을 바꾼 연구용 합성 후보입니다. 실제 패널의 열화 원인이나 수리 효과를 증명하지 않습니다.</p>
    <p>6단 모두 같은 T9 폭과 C3 값을 적용합니다. T9 길이는 4.5 µm, C3 연결은 N2–OUT입니다. 원본 C3의 N4–N3 연결과 다릅니다.</p>
    <fieldset disabled={busy}>
      <legend>T9 / C3 설정</legend>
      <label>T9 폭 (µm) <input type="number" min="4" max="512" step="any" value={width} onChange={e => change(e.target.value, cap)} /></label>{" "}
      <label>C3 (pF) <input type="number" min="0.05" max="5" step="any" value={cap} onChange={e => change(width, e.target.value)} /></label>
      <div className="chips">{[56, 112].flatMap(w => [0.3, 1].map(c => <button key={`${w}-${c}`} onClick={() => change(String(w), String(c))}>T9 {w} µm / C3 {c} pF</button>))}</div>
      <button onClick={run} disabled={!valid || busy}>{busy ? "ngspice 계산 중…" : "이 조건으로 실제 실행"}</button>
      {!valid && <p role="alert">T9는 4–512 µm, C3는 0.05–5 pF 범위로 입력하세요.</p>}
    </fieldset>
    {busy && <p role="status">실제 계산 중입니다. 화면을 떠나도 서버 계산이 즉시 취소되지는 않습니다.</p>}
    {error && <p role="alert">{error}</p>}
    <details><summary>고정 조건과 원본 대비 변경점</summary>
      <ul>
        <li>T10 소스: CKA. T12: W=8 µm. T14: D=N2, G=CKA, S=N8. T15: D=N8, G=IN, S=VGL, W/L=8/4.5 µm.</li>
        <li>C3: N2–OUT. C4: OUT–0, 5 pF. T16: N3/N4의 분리된 가지 유지. 인위적 100 MΩ 누설저항 없음.</li>
        <li>이전 OUT→다음 IN, 홀수/짝수 단 클록 교대. VGH/VGL=+8/−9 V. H=4 µs. 클록 주기=8 µs, 평탄부=2.95 µs, 에지=50 ns.</li>
        <li>FLM: 160 µs부터, 주기 120 µs. ESR: −9 V 유지 후 80–80.05 µs에 +8 V. 총 해석 400 µs.</li>
        <li>모델 VT0=2.305752757586326. 측정 기준 Vth≈−2 V의 단일점 보정이며 VT0와 측정 Vth는 다릅니다. 실제 TFT 전체 특성 보정 아님. U0=65, SS=0.3, GOFF=10⁻¹⁴, 열화 없음.</li>
      </ul>
    </details>
    {result?.series && <section>
      <h3>이번 실행: T9 {result.parameters!.t9_width_um} µm / C3 {result.parameters!.c3_pf} pF</h3>
      <p>수치 해석 완료는 회로 규격 PASS가 아닙니다. 파형은 표시용 축약입니다. 실행 ID: {result.job}</p>
      {result.deck_url && <a href={result.deck_url} target="_blank" rel="noreferrer">실제 입력 덱 보기 / 저장</a>}
      <div className="chips">{[0,150,270].map(t => <button key={t} onClick={() => setWindowStart(t)}>{t === 0 ? "시작 구간" : t === 150 ? "첫 펄스 구간" : "둘째 펄스 구간"}</button>)}</div>
      <svg viewBox="0 0 900 540" role="img" aria-label="GB 6단 출력 파형" style={{width:"100%", background:"white"}}>
        {Object.entries(result.series.outputs).filter(([key]) => /^OUT[1-6]$/i.test(key)).map(([key, values], row) => {
          const points = result.series!.time_us.flatMap((time, i) => time >= windowStart && time <= windowStart + 100 ? [`${70+(time-windowStart)*8},${row*80+15+(10-values[i])*3}`] : []).join(" ");
          return <g key={key}><text x="5" y={row*80+40}>{key}</text><line x1="70" x2="870" y1={row*80+15+19*3} y2={row*80+15+19*3} stroke="#ccc"/><polyline points={points} fill="none" stroke="#185bba" strokeWidth="1.3"/><text x="70" y={row*80+12} fontSize="10">+8 / −9 V</text></g>;
        })}
        <text x="70" y="515">{windowStart} µs</text><text x="780" y="515">{windowStart+100} µs</text>
      </svg>
    </section>}
    <p className="note">GitHub Pages에서는 새 계산을 실행할 수 없습니다. Python + OSDI 지원 ngspice 백엔드가 필요하며, 연결 실패 시 다른 예제 결과를 보여주지 않습니다.</p>
  </main>;
}
