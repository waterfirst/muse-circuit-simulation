import { useState } from "react";
import { BROKEN, DEFAULT_PARAMS, NETS, PRESETS, PRESET_POLARITY, PRESET_WIDTH_H,
  buildDesc, driverLanes, presetCaps, presetTft, presetToMap, schemInfoText,
  type CapConn, type Net, type Params, type PassFail, type Pin, type PresetName,
  type Series, type SeriesInfo, type TName, type TftMap } from "../lib/circuit";
import { tryBackend } from "../lib/api";
import ParamForm from "../components/ParamForm";
import TftTable from "../components/TftTable";
import { MarginPanel, StressPanel } from "../components/Aging";
import CapsEditor from "../components/CapsEditor";
import OptimizerPanel from "../components/Optimizer";
import SchemEditor, { NetPicker } from "../components/SchemEditor";
import SourceTrace from "../components/SourceTrace";
import WavePlot from "../components/WavePlot";
import demo from "../data/demo.json";

const DEMO_SERIES = demo.series as Series;
const DEMO_INFO = demo.info as SeriesInfo;
const DEMO_SUMMARY = "vC 검증 파형: OUT1 min -9.499 max 9.169, 6단 2프레임, H=4.0us (250kHz)";

export default function LabPage() {
  const [preset, setPreset] = useState<PresetName>("GW");
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [tft, setTft] = useState<TftMap>(() => presetTft("GW"));
  const [caps, setCaps] = useState<CapConn[]>(() => presetCaps("GW"));
  const [pickedNet, setPickedNet] = useState<Net | null>(null);
  const [lanes, setLanes] = useState<[string, string][]>(() => driverLanes(6, ["a","b","c","q","qb"]));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(driverLanes(6, ["a","b","c","q","qb"]).map(([, lab]) => [lab, true])));
  const [status, setStatus] = useState("저장된 검증 파형을 보여줍니다 (실행 전)");
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
    setStatus("실행 중... (ngspice)");
    setErrs([]); setWarns([]); setSugs([]); setSummary(""); setPassfail(null); setCir("");
    const j = await tryBackend(desc);
    setRunning(false);
    if (!j) {
      setStatus("서버에 닿지 않아 저장된 검증 파형을 보여줍니다 (실시간 시뮬 아님)");
      setWarns(["127.0.0.1:8768 백엔드가 꺼져 있으면 데모만 표시됩니다. `python3 server/app.py`로 켜세요."]);
      setSummary(DEMO_SUMMARY);
      setSeries(DEMO_SERIES); setInfo(DEMO_INFO); setMargin(null);
      return;
    }
    setErrs(j.errors || []); setWarns(j.warnings || []); setSugs(j.suggestions || []);
    if (!j.ok) { setStatus("중단됨 (위 오류 확인)"); return; }
    setStatus(`실제 시뮬 완료 job=${j.job} H=${j.timing?.H_us}us`);
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
      <h1>드라이버 Lab — GW / EM / GC / GI</h1>
      <p className="note">프리셋을 고르고 실행하면 서버에서 검증 후 ngspice로 시뮬레이션합니다.
        W/L·캐패시터는 합성 가정값입니다. FLM은 EM/GC/GI에서 스타트(STV) 신호입니다.</p>
      <div className="card">
        <h3>0. 프리셋</h3>
        <div className="chips">
          {PRESETS.map((p) => (
            <button key={p} className={"chip" + (preset === p ? " on" : "")}
              onClick={() => loadPreset(p)}>{p === "GW10T2C" ? "GW 10T2C (T10 NMOS)" :
                p === "EM12T2C" ? "EM 12T2C (사용자 넷리스트)" : p}</button>
          ))}
          <button className="chip" onClick={() => { setPreset("GW"); setTft(presetToMap(BROKEN)); }}>
            고장 예시 (A 플로팅)</button>
        </div>
        <p className="note">GW 10T2C: T1~T9 PMOS, T10 NMOS 사용자 사례. EM 12T2C: 입력 넷리스트의 T1~T12/C1~C2를 그대로 반영한 사례.
          EM: Samsung US 11,205,374 B2 Fig.4 12T3C. GC/GI: 동일 스테이지 재사용(가정, 폭 2H).
          세부 근거는 아래 1번 표와 docs/CIRCUITS.md.</p>
      </div>
      <SourceTrace preset={preset} />
      <ParamForm params={params} onChange={setParams} />
      <div className="card">
        <h3>2.5 회로도 (TFT를 누르면 순환 선택, 핀 직접 연결) — P는 게이트 버블</h3>
        <SchemEditor tft={tft} caps={caps} pickedNet={pickedNet} onPickNet={setPickedNet} onPinClick={onPinClick} />
        <p className="note" id="scheminfo">{schemInfoText(tft)}</p>
        <NetPicker picked={pickedNet} onPick={setPickedNet} />
      </div>
      <div className="card">
        <h3>2. TFT 연결 (G / S / D / W / L / P·N)</h3>
        <TftTable tft={tft}
          onChange={(t, pin, net) => setPin(t, pin, net)}
          onToggle={(t, on) => toggleTft(t, on)}
          onSize={(t, k, v) => setTft((p) => ({ ...p, [t]: { ...p[t], [k]: v } }))}
          onType={(t, ty) => setTft((p) => ({ ...p, [t]: { ...p[t], type: ty } }))}
          onDeg={(t, k, v) => setTft((p) => ({ ...p, [t]: { ...p[t], [k]: v } }))} />
        <p className="note">허용 넷: VGH VGL FLM CLK1 CLK2 A B C Q QB OUT IN N1~N8. T1~T12.
          ΔVth/Ion/Ioff/SS는 fresh(0/1/1/1)와 다르면 노란색. 온도는 1번 패널.</p>
      </div>
      <CapsEditor caps={caps}
        onChange={(i, c) => setCaps((p) => p.map((x, j) => (j === i ? c : x)))}
        onAdd={() => setCaps((p) => [...p, { a: "VGH", b: "QB", pf: 0.5, name: `C${p.length + 1}`, on: true }])}
        onRemove={(i) => setCaps((p) => p.filter((_, j) => j !== i))} />
      <div className="card">
        <h3>3. 실행</h3>
        <button id="run" className="primary" onClick={run} disabled={running}>시뮬레이션 실행</button>
        <span id="status"> {status}</span>
        <div id="errs" className="msg">{errs.length > 0 && (<span>오류:<br />{errs.map((e, i) => (<span key={i}>- {e}<br /></span>))}</span>)}</div>
        <div id="warns" className="msg">{warns.length > 0 && (<span>경고:<br />{warns.map((e, i) => (<span key={i}>! {e}<br /></span>))}</span>)}</div>
        <div id="sugs" className="msg">{sugs.length > 0 && (<span>수정 제안:<br />{sugs.map((e, i) => (<span key={i}>&gt; {e}<br /></span>))}</span>)}</div>
        <pre id="summary">{summary}</pre>
      </div>
      {passfail && (
        <div className="card">
          <h3>3b. 스테이지/프레임 판정: {passfail.pass
            ? <span className="pass">PASS</span> : <span className="fail">FAIL</span>}</h3>
          <table><tbody>
            <tr><th>스테이지</th><th>판정</th><th>펄스수</th><th>폭(H)</th><th>극값(V)</th></tr>
            {Object.entries(passfail.stages).map(([k, s]) => (
              <tr key={k}><td>{k}</td>
                <td className={s.pass ? "pass" : "fail"}>{s.pass ? "PASS" : "FAIL"}</td>
                <td>{s.pulses}</td><td>{s.width_H ?? "-"}</td><td>{s.extreme ?? "-"}</td></tr>
            ))}
          </tbody></table>
          <div className="msg">{passfail.reasons.map((r, i) => (<div key={i}>- {r}</div>))}</div>
          <p className="note">기준: 프레임당 정확히 1개 활성 펄스, 단 순서대로.
            low_pulse: low ≤ −6V, 휴지 ≥ VGH−1.5V. high_pulse: high ≥ VGH−1.5V,
            휴지 ≤ rest spec, 출력폭 = 스타트폭 ±1.5H.</p>
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
      <OptimizerPanel
        getDesc={() => buildDesc(params, tft, preset, caps) as unknown as Record<string, unknown>}
        onApply={(ntft, ncaps) => {
          setTft((p) => {
            const n = { ...p };
            for (const k of Object.keys(ntft)) {
              const t = k as keyof typeof n;
              if (n[t]) n[t] = { ...n[t], ...(ntft as Record<string, object>)[k] };
            }
            return n;
          });
          setCaps((p) => p.map((c) =>
            c.name === "C1" ? { ...c, pf: ncaps.C1 } :
            c.name === "C2" ? { ...c, pf: ncaps.C2 } : c));
        }} />
      <WavePlot series={series} info={info} enabled={enabled} lanes={lanes}
        onToggleLane={(lab) => setEnabled((p) => ({ ...p, [lab]: !p[lab] }))}
        marginReqLow={margin} />
      {cir && (
        <div className="card">
          <h3>5. 넷리스트</h3>
          <button onClick={downloadCir}>.cir 다운로드</button>
          <span className="note"> job={job} · 서버에도 server/runs/{job}/job.cir 로 저장됨</span>
          <pre>{cir}</pre>
        </div>
      )}
    </div>
  );
}
