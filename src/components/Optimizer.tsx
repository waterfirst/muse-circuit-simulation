import { useEffect, useRef, useState } from "react";
import { getOptStatus, postOpt } from "../lib/api";
import type { TftMap } from "../lib/circuit";

interface Props {
  getDesc: () => Record<string, unknown>;
  onApply: (tft: TftMap, caps: { C1: number; C2: number }) => void;
}

export default function OptimizerPanel({ getDesc, onApply }: Props) {
  const [iters, setIters] = useState(60);
  const [clk2, setClk2] = useState("16, 26, 36, 46, 56");
  const [job, setJob] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [best, setBest] = useState<{ n: number; frames: [number, number][];
    mn: number; mx: number; W: Record<string, number>; L: Record<string, number>;
    C: Record<string, number>; cir: string } | null>(null);
  const timer = useRef<number | null>(null);

  const poll = async () => {
    const s = await getOptStatus();
    if (!s) return;
    setLog(s.log || []);
    setRunning(s.running);
    if (!s.running && s.result?.ok && s.result.best) {
      setBest(s.result.best);
      if (timer.current) { clearInterval(timer.current); timer.current = null; }
    }
    if (!s.running && timer.current) { clearInterval(timer.current); timer.current = null; }
  };

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = async () => {
    const desc = getDesc() as Record<string, unknown>;
    const starts = clk2.split(/[,\s]+/).map((x) => parseFloat(x)).filter((x) => !isNaN(x));
    const r = await postOpt({ ...desc, iters, clk2_starts: starts, seed: 1 });
    if (!r) { setLog(["백엔드 연결 실패"]); return; }
    if (!r.ok) { setLog(r.errors || ["시작 실패"]); return; }
    setJob(r.job || "");
    setBest(null);
    setRunning(true);
    setLog(["시작됨 job=" + (r.job || "")]);
    if (timer.current) clearInterval(timer.current);
    timer.current = window.setInterval(poll, 5000);
  };

  const apply = () => {
    if (!best) return;
    const tft = {} as TftMap;
    for (let i = 1; i <= 10; i++) {
      const k = `T${i}`;
      (tft as Record<string, unknown>)[k] = {
        W: best.W[String(i)] ?? best.W[i], L: best.L[String(i)] ?? best.L[i] };
    }
    onApply(tft, { C1: best.C.C1, C2: best.C.C2 });
  };

  const download = () => {
    if (!best) return;
    const blob = new Blob([best.cir], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `opt_${job || "best"}.cir`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="card">
      <h3>4. 자동 최적화 (hill-climb, W/L/C + clk2 다중윈도우)</h3>
      <p className="note">뮤즈 넷리스트 구조 고정. clk2 저구간을 여러 개 열고 W/L/C를 등반 탐색한다.
        1만회 탐색에서 clk 고정 시 최대 2~3펄스, clk2 5윈도우 시 5~6펄스 확인됨.</p>
      <label>반복 횟수 <input type="number" value={iters} min={4} max={400}
        onChange={(e) => setIters(parseInt(e.target.value) || 60)} style={{ width: 70 }} /></label>
      {" "}
      <label>clk2 저구간 시작 (us, 쉼표 구분) <input value={clk2}
        onChange={(e) => setClk2(e.target.value)} style={{ width: 220 }} /></label>
      {" "}
      <button className="primary" onClick={start} disabled={running}>
        {running ? "최적화 중..." : "최적화 시작"}</button>
      {job && <span className="note"> job={job}</span>}
      {log.length > 0 && <pre>{log.slice(-10).join("\n")}</pre>}
      {best && (
        <div>
          <p>최적: <b>{best.n}펄스</b> {best.frames.map((f) => `${f[0]}~${f[1]}us`).join(", ")}
            {" "}min {best.mn}V max {best.mx}V</p>
          <button onClick={apply}>이 값을 TFT/C 표에 적용</button>
          {" "}<button onClick={download}>.cir 다운로드</button>
        </div>
      )}
    </div>
  );
}
