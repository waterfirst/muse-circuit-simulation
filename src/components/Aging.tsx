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
    setRunning(true); setStatus("Estimating... (one fresh-circuit run)");
    setRes(null);
    const r = await postStress({ desc: getDesc(), temp_C: temp, hours, coefs });
    setRunning(false);
    if (!r) { setStatus("Static page: live sim unavailable."); return; }
    if (!r.ok) { setStatus("Stopped: " + (r.errors || []).join("; ")); return; }
    setRes(r);
    setStatus(`Done job=${r.job} (fresh-waveform based, window ${r.window_us?.join("-")}us)`);
  };

  return (
    <div className="card">
      <h3>Degradation estimate (hot long-term stress to dVth/ion/ioff/ss)</h3>
      <div className="row">
        <div><label>Temp (C)</label>
          <input type="number" step={1} value={temp} onChange={(e) => setTemp(parseFloat(e.target.value))} /></div>
        <div><label>Time (h)</label>
          <input type="number" step={10} value={hours} onChange={(e) => setHours(parseFloat(e.target.value))} /></div>
        <div><label>&nbsp;</label><button onClick={run} disabled={running}>Run stress estimate</button></div>
      </div>
      <details>
        <summary>Advanced: BTS-law coefficients (synthetic assumptions)</summary>
        <div className="row">
          {Object.keys(STRESS_COEFS).map((k) => (
            <div key={k}><label>{k}</label>
              <input type="number" step={0.001} style={{ width: 90 }} value={coefs[k]}
                onChange={(e) => setCoefs((p) => ({ ...p, [k]: parseFloat(e.target.value) }))} /></div>
          ))}
        </div>
      </details>
      <p className="note">Law: dVth=A t^N exp(Ea/k (1/Tref-1/T)) bias.
        Per-TFT on-duty, drive voltage, and off-bias measured as time-weighted means from the fresh-circuit waveform.
        A full simulated driver frame (scan+hold) equals one real frame, so no extra weighting. {res?.weight_note}</p>
      <span>{status}</span>
      {res?.table && (
        <div style={{ overflowX: "auto" }}><table><tbody>
          <tr><th>TFT</th><th>duty_on</th><th>Von</th><th>Voff</th><th>dVth</th><th>ion</th><th>ioff</th><th>ss</th></tr>
          {res.table.map((r) => (
            <tr key={r.tft}><td>{r.tft}</td><td>{r.duty_on}</td><td>{r.von_V}</td>
              <td>{r.voff_V}</td><td>{r.dVth}</td><td>{r.ion}</td>
              <td>{r.ioff}</td><td>{r.ss}</td></tr>
          ))}
        </tbody></table></div>
      )}
      {res?.table && (
        <div><button className="primary" onClick={() => onApply(res.table!)}>Apply to TFT table (dVth clamped to +/-2V)</button>
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
  if (!grid.length) return <p className="note">Computing...</p>;
  let bi = 0, bj = 0, bd = 1e9;
  m.vgh.forEach((g, i) => m.vgl.forEach((l, j) => {
    const d = Math.abs(g - nominal.VGH) + Math.abs(l - nominal.VGL);
    if (d < bd) { bd = d; bi = i; bj = j; }
  }));
  const isDriver = m.kind !== "pixel";
  return (
    <div style={{ overflowX: "auto" }}>
      <p><b>{which === "degraded" ? "Aged circuit" : "Fresh circuit"}</b>
        {m.kind === "pixel" && m.ref_i_uA != null && (
          <span className="note"> ref fresh@nominal {m.ref_i_uA.toFixed(4)}uA</span>)}</p>
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
    const vgh = parseList(vghT).slice(0, 5), vgl = parseList(vglT).slice(0, 5);
    if (vgh.length < 2 || vgl.length < 2) { setStatus("Enter at least 2 values each for VGH/VGL"); return; }
    if (vgh.length * vgl.length > 9) {
      setStatus(`Public margin cap is 9 cells (now ${vgh.length}x${vgl.length}=${vgh.length * vgl.length}): shorten the lists (e.g. 3 VGH x 3 VGL)`);
      return;
    }
    setM(null); setStatus("Starting margin map...");
    const s = await postMargin({ desc: getDesc(), vgh, vgl });
    if (!s) { setStatus("Static page: live sim unavailable."); return; }
    if (!s.ok) { setStatus("Stopped: " + (s.errors || []).join("; ")); return; }
    setStatus(`Running... (${s.total} cells total)`);
    if (timer.current) clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      const st = await getMargin(s.margin_job!);
      if (!st) { setStatus("Poll failed (check backend)"); return; }
      setM(st);
      setStatus(st.state === "done" ? `Done ${st.margin_job}` :
        st.state === "error" ? `Error: ${st.error}` :
        `Progress ${st.done}/${st.total}`);
      if (st.state !== "running" && timer.current) {
        clearInterval(timer.current); timer.current = null;
      }
    }, 2000);
  };

  const d = getDesc() as { VGH?: number; vgh?: number; VGL?: number; vgl?: number };
  const nominal = { VGH: Number(d.VGH ?? d.vgh ?? 8), VGL: Number(d.VGL ?? d.vgl ?? -9.5) };

  return (
    <div className="card">
      <h3>VGH x VGL margin map ({kind === "driver" ? "verdict P/F" : "emission-current change %"})</h3>
      <div className="row">
        <div><label>VGH list (V)</label>
          <input style={{ width: 160 }} value={vghT} onChange={(e) => setVghT(e.target.value)} /></div>
        <div><label>VGL list (V)</label>
          <input style={{ width: 160 }} value={vglT} onChange={(e) => setVglT(e.target.value)} /></div>
        <div><label>&nbsp;</label><button onClick={run}>Run margin map (background)</button></div>
      </div>
      <p className="note">Sweeps aged (current TFT table + temp) side by side with fresh. Black border = cell nearest your settings. Hover a cell for the job id. Public cap 9 cells (3x3). {kind === "pixel" ? "Change is vs fresh@nominal current." : ""}</p>
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
