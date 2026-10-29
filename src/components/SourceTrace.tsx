import { EM_PATENT, EM_REUSE_NOTE, EM_TRACE, EM_TRACE_NOTES } from "../lib/sources";
import type { PresetName } from "../lib/circuit";

export default function SourceTrace({ preset }: { preset: PresetName }) {
  if (preset === "GW" || preset === "GW10T2C") {
    return (
      <div className="card" id="sourcetrace">
        <h3>1. 연결 근거 추적</h3>
        <p className="note">이 프리셋은 기존 GW 토폴로지를 이어쓴 것으로, 특허 문장 단위 근거 추적을 제공하지 않습니다.
          연결은 2번 표에서 직접 확인하십시오.</p>
      </div>
    );
  }
  if (preset === "EM12T2C") {
    return (
      <div className="card" id="sourcetrace">
        <h3>1. 연결 근거 추적</h3>
        <p className="note">사용자 입력 넷리스트 사례로, 특허 근거 추적을 제공하지 않습니다.</p>
      </div>
    );
  }
  return (
    <div className="card" id="sourcetrace">
      <h3>1. 연결 근거 추적 — {EM_PATENT}</h3>
      {(preset === "GC" || preset === "GI") && <p className="note">{EM_REUSE_NOTE}</p>}
      <table id="tracetab">
        <thead><tr><th>소자</th><th>특허</th><th>연결</th><th>특허 근거 (요약)</th></tr></thead>
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
