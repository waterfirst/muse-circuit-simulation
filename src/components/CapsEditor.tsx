import { NETS, type CapConn, type Net } from "../lib/circuit";
import { useLang } from "../lib/i18n";

interface Props {
  caps: CapConn[];
  onChange: (i: number, c: CapConn) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}

export default function CapsEditor({ caps, onChange, onAdd, onRemove }: Props) {
  const { lang } = useLang();
  const en = lang === "en";
  return (
    <div className="card">
      <h3>2b. {en ? "Capacitors (node pair + pF, synthetic assumptions)" : "커패시터 (노드쌍 + pF, 합성 가정값)"}</h3>
      <table>
        <tbody>
          <tr><th>{en ? "Name" : "이름"}</th><th>{en ? "Node A" : "노드A"}</th><th>{en ? "Node B" : "노드B"}</th><th>pF</th><th>{en ? "Use" : "사용"}</th><th /></tr>
          {caps.map((c, i) => (
            <tr key={i}>
              <td>{c.name}</td>
              {(["a", "b"] as const).map((k) => (
                <td key={k}><select value={c[k]}
                  onChange={(e) => onChange(i, { ...c, [k]: e.target.value as Net })}>
                  {NETS.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select></td>
              ))}
              <td><input type="number" step={0.1} min={0} max={100} value={c.pf}
                style={{ width: 76 }} onChange={(e) => onChange(i, { ...c, pf: parseFloat(e.target.value) })} /></td>
              <td><input type="checkbox" checked={c.on}
                onChange={(e) => onChange(i, { ...c, on: e.target.checked })} /></td>
              <td><button onClick={() => onRemove(i)} aria-label={`remove ${c.name}`}>−</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd}>+ {en ? "Add capacitor" : "캐패시터 추가"}</button>
    </div>
  );
}
