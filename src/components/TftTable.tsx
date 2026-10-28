import { NETS, TNAMES, type Net, type Pin, type TName, type TftMap } from "../lib/circuit";

interface Props {
  tft: TftMap;
  onChange: (t: TName, pin: Pin, net: Net) => void;
  onToggle: (t: TName, on: boolean) => void;
}

export default function TftTable({ tft, onChange, onToggle }: Props) {
  return (
    <table id="tfttab">
      <tbody>
        <tr><th>TFT</th><th>G</th><th>S</th><th>D</th><th>사용</th></tr>
        {TNAMES.map((t) => (
          <tr key={t}>
            <td>{t}</td>
            {(["G","S","D"] as Pin[]).map((pin) => (
              <td key={pin}>
                <select value={tft[t][pin]}
                  onChange={(e) => onChange(t, pin, e.target.value as Net)}>
                  {NETS.map((n) => (<option key={n} value={n}>{n}</option>))}
                </select>
              </td>
            ))}
            <td>
              <input type="checkbox" checked={tft[t].on}
                onChange={(e) => onToggle(t, e.target.checked)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
