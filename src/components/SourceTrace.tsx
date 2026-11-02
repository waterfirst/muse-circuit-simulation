import { EM_PATENT, EM_REUSE_NOTE, EM_TRACE, EM_TRACE_NOTES } from "../lib/sources";
import type { PresetName } from "../lib/circuit";
import { useLang } from "../lib/i18n";

export default function SourceTrace({ preset }: { preset: PresetName }) {
  const { lang } = useLang();
  const en = lang === "en";
  if (preset === "GW") {
    return (
      <div className="card" id="sourcetrace">
        <h3>1. {en ? "Connection evidence trace" : "연결 근거 추적"}</h3>
        <p className="note">{en ? "This preset reuses the existing GW topology and does not provide patent-sentence-level traceability. Check the direct wiring in table 2." : "이 프리셋은 기존 GW 토폴로지를 이어쓴 것으로, 특허 문장 단위 근거 추적을 제공하지 않습니다. 연결은 2번 표에서 직접 확인하십시오."}</p>
      </div>
    );
  }
  return (
    <div className="card" id="sourcetrace">
      <h3>1. {en ? "Connection evidence trace" : "연결 근거 추적"} — {EM_PATENT}</h3>
      {(preset === "GC" || preset === "GI") && <p className="note">{EM_REUSE_NOTE}</p>}
      <table id="tracetab">
        <thead><tr><th>{en ? "Device" : "소자"}</th><th>{en ? "Patent" : "특허"}</th><th>{en ? "Connection" : "연결"}</th><th>{en ? "Patent evidence (summary)" : "특허 근거 (요약)"}</th></tr></thead>
        <tbody>
          {EM_TRACE.map((r) => (
            <tr key={r.id}><td>{r.id}</td><td>{r.patent}</td><td>{r.conn}</td><td>{r.sentence}</td></tr>
          ))}
        </tbody>
      </table>
      <ul className="note">
        {EM_TRACE_NOTES.map((n, i) => (<li key={i}>{n}</li>))}
      </ul>
    </div>
  );
}
