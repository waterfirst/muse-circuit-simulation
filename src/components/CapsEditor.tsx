import { NETS, type CapConn, type Net } from "../lib/circuit";

interface Props {
  caps: CapConn[];
  onChange: (i: number, c: CapConn) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}

export default function CapsEditor({ caps, onChange, onAdd, onRemove }: Props) {
  return (
    <div className="card">
      <h3>2b. 커패시터 (노드쌍 + pF, 합성 가정값)</h3>
      <table>
        <tbody>
          <tr><th>이름</th><th>노드A</th><th>노드B</th><th>pF</th><th>사용</th><th /></tr>
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
      <button onClick={onAdd}>+ 캐패시터 추가</button>
    </div>
  );
}
