import { useState } from "react";
import { BROKEN, DEFAULT_PARAMS, LANES, NETS, VC, buildDesc, presetToMap, schemInfoText,
  type Net, type Params, type Pin, type Series, type SeriesInfo, type TName, type TftMap } from "../lib/circuit";
import { tryBackend } from "../lib/api";
import ParamForm from "../components/ParamForm";
import TftTable from "../components/TftTable";
import SchemEditor, { NetPicker } from "../components/SchemEditor";
import WavePlot from "../components/WavePlot";
import demo from "../data/demo.json";

const DEMO_SERIES = demo.series as Series;
const DEMO_INFO = demo.info as SeriesInfo;
const DEMO_SUMMARY = "vC 검증 파형: OUT1 min -9.499 max 9.169, 6단 2프레임, H=4.0us (250kHz)";

export default function LabPage() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [tft, setTft] = useState<TftMap>(() => presetToMap(VC));
  const [pickedNet, setPickedNet] = useState<Net | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    () => Object.fromEntries(LANES.map(([, lab]) => [lab, true])));
  const [status, setStatus] = useState("저장된 검증 파형을 보여줍니다 (실행 전)");
  const [errs, setErrs] = useState<string[]>([]);
  const [warns, setWarns] = useState<string[]>([]);
  const [sugs, setSugs] = useState<string[]>([]);
  const [summary, setSummary] = useState(DEMO_SUMMARY);
  const [series, setSeries] = useState<Series>(DEMO_SERIES);
  const [info, setInfo] = useState<SeriesInfo>(DEMO_INFO);
  const [margin, setMargin] = useState<number | null>(null);
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
  const loadPreset = (p: typeof VC) => setTft(presetToMap(p));

  const run = async () => {
    const desc = buildDesc(params, tft);
    setRunning(true);
    setStatus("실행 중... (ngspice)");
    setErrs([]); setWarns([]); setSugs([]); setSummary("");
    const j = await tryBackend(desc);
    setRunning(false);
    if (!j) {
      setStatus("서버에 닿지 않아 저장된 검증 파형을 보여줍니다 (실시간 시뮬 아님)");
      setWarns(["테일스케일 접속 필요. 노트북 서버가 꺼져 있으면 데모만 표시됩니다."]);
      setSummary(DEMO_SUMMARY);
      setSeries(DEMO_SERIES); setInfo(DEMO_INFO); setMargin(null);
      return;
    }
    setErrs(j.errors || []); setWarns(j.warnings || []); setSugs(j.suggestions || []);
    if (!j.ok) { setStatus("중단됨 (위 오류 확인)"); return; }
    setStatus(`실제 시뮬 완료 job=${j.job} H=${j.timing?.H_us}us`);
    setSummary(JSON.stringify({ summary: j.summary, margin: j.margin, timing: j.timing, rails: j.rails }, null, 1));
    setMargin(j.margin?.req_low ?? null);
    if (j.series && j.info) { setSeries(j.series); setInfo(j.info); }
  };

  return (
    <div className="wrap">
      <div style={{ marginBottom: 8 }}><a href="#/gw7t">GW 7T 확정 리포트 (회로도+파형)</a></div>
      <h1>GW Lab - 넷리스트 실험실</h1>
      <p className="note">VGH VGL 해상도 주파수를 고르고 TFT 연결을 적은 뒤 실행을 누르면 서버에서 검증 후 시뮬레이션합니다. 연결이 어긋나면 실행 전에 경고와 수정 제안이 뜹니다.</p>
      <ParamForm params={params} onChange={setParams} />
      <div className="card">
        <h3>2.5 회로도 (TFT를 누르면 순환 선택, 핀 직접 연결)</h3>
        <SchemEditor tft={tft} pickedNet={pickedNet} onPickNet={setPickedNet} onPinClick={onPinClick} />
        <p className="note" id="scheminfo">{schemInfoText(tft)}</p>
        <NetPicker picked={pickedNet} onPick={setPickedNet} />
      </div>
      <div className="card">
        <h3>2. TFT 연결 (G / S / D)</h3>
        <TftTable tft={tft}
          onChange={(t, pin, net) => setPin(t, pin, net)}
          onToggle={(t, on) => toggleTft(t, on)} />
        <p className="note">허용 넷: VGH VGL FLM CLK1 CLK2 A B C Q QB OUT IN. 검증 vC: T2 G:C D:A, T5 D:VGL. T1 T6 T7 필수.</p>
        <button id="presetVC" onClick={() => loadPreset(VC)}>검증 vC 불러오기</button>
        <button id="presetBroken" onClick={() => loadPreset(BROKEN)}>고장 예시 (A 플로팅)</button>
      </div>
      <div className="card">
        <h3>3. 실행</h3>
        <button id="run" className="primary" onClick={run} disabled={running}>시뮬레이션 실행</button>
        <span id="status"> {status}</span>
        <div id="errs" className="msg">{errs.length > 0 && (<span>오류:<br />{errs.map((e, i) => (<span key={i}>- {e}<br /></span>))}</span>)}</div>
        <div id="warns" className="msg">{warns.length > 0 && (<span>경고:<br />{warns.map((e, i) => (<span key={i}>! {e}<br /></span>))}</span>)}</div>
        <div id="sugs" className="msg">{sugs.length > 0 && (<span>수정 제안:<br />{sugs.map((e, i) => (<span key={i}>&gt; {e}<br /></span>))}</span>)}</div>
        <pre id="summary">{summary}</pre>
      </div>
      <WavePlot series={series} info={info} enabled={enabled}
        onToggleLane={(lab) => setEnabled((p) => ({ ...p, [lab]: !p[lab] }))}
        marginReqLow={margin} />
    </div>
  );
}
