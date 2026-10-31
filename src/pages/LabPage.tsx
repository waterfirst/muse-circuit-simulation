import { useState } from "react";
import { BROKEN, DEFAULT_PARAMS, NETS, PRESETS, PRESET_POLARITY, PRESET_WIDTH_H,
  buildDesc, driverLanes, presetCaps, presetTft, presetToMap, schemInfoText,
  type CapConn, type Net, type Params, type PassFail, type Pin, type PresetName,
  type Series, type SeriesInfo, type TName, type TftMap } from "../lib/circuit";
import { tryBackend } from "../lib/api";
import { t, useLang } from "../lib/i18n";
import ParamForm from "../components/ParamForm";
import TftTable from "../components/TftTable";
import { MarginPanel, StressPanel } from "../components/Aging";
import CapsEditor from "../components/CapsEditor";
import SchemEditor, { NetPicker } from "../components/SchemEditor";
import SourceTrace from "../components/SourceTrace";
import WavePlot from "../components/WavePlot";
import demo from "../data/demo.json";

const DEMO_SERIES = demo.series as Series;
const DEMO_INFO = demo.info as SeriesInfo;
const DEMO_SUMMARY = "stored verification waveform: OUT1 min -9.499 max 9.169, 6 stages, 2 frames, H=4.0us (250kHz)";

export default function LabPage() {
  const { lang } = useLang();
  const [preset, setPreset] = useState<PresetName>("GW");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [tft, setTft] = useState<TftMap>(() => presetTft("GW"));
  const [caps, setCaps] = useState<CapConn[]>(() => presetCaps("GW"));
  const [pickedNet, setPickedNet] = useState<Net | null>(null);
  const [lanes, setLanes] = useState<[string, string][]>(() => driverLanes(6, ["a","b","c","q","qb"]));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(driverLanes(6, ["a","b","c","q","qb"]).map(([, lab]) => [lab, true])));
  const [status, setStatus] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [sugs, setSugs] = useState<string[]>([]);
  const [summary, setSummary] = useState(DEMO_SUMMARY);
  const [series, setSeries] = useState<Series>(DEMO_SERIES);
  const [info, setInfo] = useState<SeriesInfo>(DEMO_INFO);
  const [margin, setMargin] = useState<number | null>(null);
  const [passfail, setPassfail] = useState<PassFail | null>(null);
  const [cir, setCir] = useState("");
  const [job, setJob] = useState("");
  const [running, setRunning] = useState(false);

  const setPin = (t: TName, pin: Pin, net: Net) =>
    setTft((prev) => ({ ...prev, [t]: { ...prev[t], [pin]: net } }));
  const toggleTft = (t: TName, on: boolean) =>
    setTft((prev) => ({ ...prev, [t]: { ...prev[t], on } }));
  const onPinClick = (t: TName, pin: Pin) => {
    if (pickedNet) setPin(t, pin, pickedNet);
    else {
      const i = NETS.indexOf(tft[t][pin]);
      setPin(t, pin, NETS[(i + 1) % NETS.length]);
    }
  };
  const loadPreset = (p: PresetName) => {
    setPreset(p);
    setTft(presetTft(p));
    setCaps(presetCaps(p));
    setParams((pr) => ({ ...pr, polarity: PRESET_POLARITY[p], start_width_H: PRESET_WIDTH_H[p] }));
  };

  const run = async () => {
    const desc = buildDesc(params, tft, preset, caps);
    setRunning(true);
    setStatus(t(lang, "running"));
    setErrs([]); setWarns([]); setSugs([]); setSummary(""); setPassfail(null); setCir("");
    const j = await tryBackend(desc);
    setRunning(false);
    if (!j) {
      setStatus(t(lang, "demo_note"));
      setWarns(["Static page: showing the stored verification waveform without live sim. To run locally, start the backend with `python3 server/app.py`."]);
      setSummary(DEMO_SUMMARY);
      setSeries(DEMO_SERIES); setInfo(DEMO_INFO); setMargin(null);
      return;
    }
    setErrs(j.errors || []); setWarns(j.warnings || []); setSugs(j.suggestions || []);
    if (!j.ok) { setStatus(t(lang, "stopped")); return; }
    setStatus(`done job=${j.job} H=${(j.timing as { H_us?: number })?.H_us}us`);
    setSummary(JSON.stringify({ summary: j.summary, timing: j.timing, rails: j.rails }, null, 1));
    setMargin(params.polarity === "low_pulse" ? -6.0 : null);
    setPassfail(j.passfail || null);
    setCir(j.cir || "");
    setJob(j.job || "");
    if (j.series && j.info) {
      setSeries(j.series); setInfo(j.info);
      const nl = driverLanes(params.stages, (j.info.internals as string[]) || []);
      setLanes(nl);
      setEnabled(Object.fromEntries(nl.map(([, lab]) => [lab, true])));
    }
  };

  const downloadCir = () => {
    const blob = new Blob([cir], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${job || preset}.cir`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="wrap">
      <h1>Driver lab — GW / EM / GC / GI</h1>
      <p className="note">Pick a preset and run: the server validates, then ngspice simulates. W/L and caps are synthetic assumptions. FLM is the start (STV) signal on EM/GC/GI.</p>
      <div className="card">
        <h3>0. Preset</h3>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p} className={"chip" + (preset === p ? " on" : "")}
              onClick={() => loadPreset(p)}>{p}</button>
          ))}
          <button className="chip" onClick={() => { setPreset("GW"); setTft(presetToMap(BROKEN)); }}>
            Broken example (A floating)</button>
        </div>
        <p className="note">EM: Samsung US 11,205,374 B2 Fig.4 12T3C. GC/GI reuse the same stage (assumption, width 2H). See the source table below and docs/CIRCUITS.md.</p>
      </div>
      <SourceTrace preset={preset} />
      <ParamForm params={params} onChange={setParams} />
      <div className="card">
        <h3>2.5 Schematic (click a TFT to cycle, direct pin wiring) — P has a gate bubble</h3>
        <SchemEditor tft={tft} caps={caps} pickedNet={pickedNet} onPickNet={setPickedNet} onPinClick={onPinClick} />
        <p className="note" id="scheminfo">{schemInfoText(tft)}</p>
        <NetPicker picked={pickedNet} onPick={setPickedNet} />
      </div>
      <div className="card">
        <h3>2. TFT wiring (G / S / D / W / L / P-N)</h3>
        <TftTable tft={tft}
          onChange={(t, pin, net) => setPin(t, pin, net)}
          onToggle={(t, on) => toggleTft(t, on)}
          onSize={(t, k, v) => setTft((p) => ({ ...p, [t]: { ...p[t], [k]: v } }))}
          onType={(t, ty) => setTft((p) => ({ ...p, [t]: { ...p[t], type: ty } }))}
          onDeg={(t, k, v) => setTft((p) => ({ ...p, [t]: { ...p[t], [k]: v } }))} />
        <p className="note">Allowed nets: VGH VGL FLM CLK1 CLK2 A B C Q QB OUT IN N1-N8. T1-T12. dVth/ion/ioff/ss highlight yellow when off fresh (0/1/1/1). Temperature is in panel 1.</p>
      </div>
      <CapsEditor caps={caps}
        onChange={(i, c) => setCaps((p) => p.map((x, j) => (j === i ? c : x)))}
        onAdd={() => setCaps((p) => [...p, { a: "VGH", b: "QB", pf: 0.5, name: `C${p.length + 1}`, on: true }])}
        onRemove={(i) => setCaps((p) => p.filter((_, j) => j !== i))} />
      <div className="card">
        <h3>3. Run</h3>
        <button id="run" className="primary" onClick={run} disabled={running}>{running ? t(lang, "running") : t(lang, "run")}</button>
        <span id="status"> {status}</span>
        <div id="errs" className="msg">{errs.length > 0 && (<span>{t(lang, "errors")}<br />{errs.map((e, i) => (<span key={i}>- {e}<br /></span>))}</span>)}</div>
        <div id="warns" className="msg">{warns.length > 0 && (<span>Warnings:<br />{warns.map((e, i) => (<span key={i}>! {e}<br /></span>))}</span>)}</div>
        <div id="sugs" className="msg">{sugs.length > 0 && (<span>Suggestions:<br />{sugs.map((e, i) => (<span key={i}>&gt; {e}<br /></span>))}</span>)}</div>
        <pre id="summary">{summary}</pre>
      </div>
      {passfail && (
        <div className="card">
          <h3>3b. Stage/frame verdict: {passfail.pass
            ? <span className="pass">PASS</span> : <span className="fail">FAIL</span>}</h3>
          <table><tbody>
            <tr><th>Stage</th><th>Verdict</th><th>Pulses</th><th>Width (H)</th><th>Extreme (V)</th></tr>
            {Object.entries(passfail.stages).map(([k, s]) => (
              <tr key={k}><td>{k}</td>
                <td className={s.pass ? "pass" : "fail"}>{s.pass ? "PASS" : "FAIL"}</td>
                <td>{s.pulses}</td><td>{s.width_H ?? "-"}</td><td>{s.extreme ?? "-"}</td></tr>
            ))}
          </tbody></table>
          <div className="msg">{passfail.reasons.map((r, i) => (<div key={i}>- {r}</div>))}</div>
          <p className="note">Rule: exactly one active pulse per frame, in stage order. low_pulse: low dips to -6V or below, idle at VGH-1.5V or above. high_pulse: high at VGH-1.5V or above, idle within rest spec, output width = start width +/-1.5H.</p>
        </div>
      )}
      <StressPanel
        getDesc={() => buildDesc(params, tft, preset, caps) as unknown as Record<string, unknown>}
        onApply={(rows) => setTft((p) => {
          const n = { ...p };
          for (const r of rows) {
            const t = r.tft as TName;
            if (n[t]) n[t] = { ...n[t],
              dVth: Math.max(-2, Math.min(2, r.dVth)),
              ion: r.ion, ioff: r.ioff, ss: r.ss };
          }
          return n;
        })} />
      <MarginPanel
        getDesc={() => buildDesc(params, tft, preset, caps) as unknown as Record<string, unknown>}
        kind="driver" />
      <WavePlot series={series} info={info} enabled={enabled} lanes={lanes}
        onToggleLane={(lab) => setEnabled((p) => ({ ...p, [lab]: !p[lab] }))}
        marginReqLow={margin} />
      {cir && (
        <div className="card">
          <h3>5. Netlist</h3>
          <button onClick={downloadCir}>Download .cir</button>
          <span className="note"> job={job} · also saved on the server at server/runs/{job}/job.cir</span>
          <pre>{cir}</pre>
        </div>
      )}
    </div>
  );
}
