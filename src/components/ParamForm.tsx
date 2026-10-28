import { hinfoText, type Params } from "../lib/circuit";

interface Props {
  params: Params;
  onChange: (p: Params) => void;
}

export default function ParamForm({ params, onChange }: Props) {
  const set = (k: keyof Params, v: number) => onChange({ ...params, [k]: v });
  return (
    <div className="card">
      <h3>1. 전원 / 타이밍</h3>
      <div className="row">
        <div><label>VGH (V, 4~12)</label>
          <input id="vgh" type="number" step={0.1} value={params.vgh}
            onChange={(e) => set("vgh", parseFloat(e.target.value))} /></div>
        <div><label>VGL (V, -14~-4)</label>
          <input id="vgl" type="number" step={0.1} value={params.vgl}
            onChange={(e) => set("vgl", parseFloat(e.target.value))} /></div>
        <div><label>해상도</label>
          <select id="res" value={params.res}
            onChange={(e) => set("res", parseInt(e.target.value))}>
            {[1080,1440,2160,2880,4320,7680].map((r) => (<option key={r}>{r}</option>))}
          </select></div>
        <div><label>주파수 (kHz)</label>
          <input id="freq" type="number" step={1} value={params.freq}
            onChange={(e) => set("freq", parseFloat(e.target.value))} /></div>
        <div><label>단수 (1~12)</label>
          <input id="stages" type="number" min={1} max={12} value={params.stages}
            onChange={(e) => set("stages", parseInt(e.target.value))} /></div>
        <div><label>프레임</label>
          <select id="frames" value={params.frames}
            onChange={(e) => set("frames", parseInt(e.target.value))}>
            <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
          </select></div>
      </div>
      <p className="note" id="hinfo">{hinfoText(params.freq)}</p>
    </div>
  );
}
