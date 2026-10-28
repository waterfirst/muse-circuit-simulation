import { NETS, RAILS, NET_COLOR, SCHEM_POS, TNAMES, pinXY, routeNetWires, type Net, type Pin, type TName, type TftMap } from "../lib/circuit";

interface Props {
  tft: TftMap;
  pickedNet: Net | null;
  onPickNet: (n: Net | null) => void;
  onPinClick: (t: TName, pin: Pin) => void;
}

export default function SchemEditor({ tft, pickedNet, onPickNet, onPinClick }: Props) {
  const { lines, labels } = routeNetWires(tft);
  const toggleNet = (net: string) => onPickNet(pickedNet === net ? null : (net as Net));
  return (
    <svg id="schem" viewBox="0 0 720 430" role="img" aria-label="GW stage schematic">
      {Object.keys(RAILS).map((net) => {
        const [rx, ry] = RAILS[net];
        const c = NET_COLOR[net] || "#333";
        return (
          <g key={net} className={"pin" + (pickedNet === net ? " sel" : "")} onClick={() => toggleNet(net)}>
            <rect x={rx - 26} y={ry - 10} width={52} height={20} rx={4} fill="none" stroke={c} strokeWidth={1.4} />
            <text x={rx} y={ry} className="netlbl">{net}</text>
          </g>
        );
      })}
      {TNAMES.filter((t) => tft[t].on).map((t) => {
        const [cx, cy] = SCHEM_POS[t];
        return (
          <g key={t}>
            <g className="tftnode">
              <circle cx={cx} cy={cy} r={22} />
              <text x={cx} y={cy}>{t}</text>
            </g>
            {(["G","S","D"] as Pin[]).map((pin) => {
              const [px, py] = pinXY(t, pin);
              const net = tft[t][pin];
              return (
                <g key={pin}>
                  <g className={"pin" + (pickedNet === net ? " sel" : "")}
                    onClick={(ev) => { ev.stopPropagation(); onPinClick(t, pin); }}>
                    <circle cx={px} cy={py} r={11} />
                    <text x={px} y={py}>{pin}</text>
                  </g>
                  <text x={px} y={py + 21} className="netlbl">{net}</text>
                  <line x1={cx} y1={cy} x2={px} y2={py} className="wire" />
                </g>
              );
            })}
          </g>
        );
      })}
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="wire" stroke={l.color} />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} className="netlbl">{l.text}</text>
      ))}
    </svg>
  );
}

export function NetPicker({ picked, onPick }: { picked: Net | null; onPick: (n: Net | null) => void }) {
  return (
    <div className="chips" id="netpick">
      {NETS.map((n) => (
        <button key={n} className={"chip" + (picked === n ? " on" : "")}
          onClick={() => onPick(picked === n ? null : n)}>{n}</button>
      ))}
    </div>
  );
}
