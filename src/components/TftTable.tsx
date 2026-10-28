import { NETS, TNAMES, type Net, type Pin, type TName, type TftMap } from "../lib/circuit";

interface Props {
  tft: TftMap;
  onChange: (t: TName, pin: Pin, net: Net) => void;
  onToggle: (t: TName, on: boolean) => void;
  onSize: (t: TName, k: "W" | "L", v: number) => void;
  onType: (t: TName, ty: "P" | "N") => void;
}

export default function TftTable({ tft, onChange, onToggle, onSize, onType }: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
    <table id="tfttab">
      <tbody>
        <tr><th>TFT</th><th>G</th><th>S</th><th>D</th><th>W(um)</th><th>L(um)</th><th>P/N</th><th>사용</th></tr>
        {TNAMES.map((t) => (
          <tr key={t} style={tft[t].on ? undefined : { opacity: 0.45 }}>
            <td>{t}</td>
            {(["G","S","D"] as Pin[]).map((pin) => (
              <td key={pin}>
                <select value={tft[t][pin]}
                  onChange={(e) => onChange(t, pin, e.target.value as Net)}>
                  {NETS.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </td>
            ))}
            <td><input type="number" step={0.5} min={0.5} max={500} value={tft[t].W ?? 4}
              style={{ width: 64 }} onChange={(e) => onSize(t, "W", parseFloat(e.target.value))} /></td>
            <td><input type="number" step={0.5} min={2} max={50} value={tft[t].L ?? 4.5}
              style={{ width: 64 }} onChange={(e) => onSize(t, "L", parseFloat(e.target.value))} /></td>
            <td><select value={tft[t].type || "P"}
              onChange={(e) => onType(t, e.target.value as "P" | "N")}>
              <option value="P">P</option><option value="N">N</option>
            </select></td>
            <td>
              <input type="checkbox" checked={tft[t].on}
                onChange={(e) => onToggle(t, e.target.checked)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
