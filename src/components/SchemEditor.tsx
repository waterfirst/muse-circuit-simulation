import { NETS, RAILS, NET_COLOR, SCHEM_POS, TNAMES, pinXY, routeNetWires,
  type CapConn, type Net, type Pin, type TName, type TftMap } from "../lib/circuit";

interface Props {
  tft: TftMap;
  caps: CapConn[];
  pickedNet: Net | null;
  onPickNet: (n: Net | null) => void;
  onPinClick: (t: TName, pin: Pin) => void;
}

/** FET glyph: PMOS gets a gate bubble, NMOS none; arrow on S stub. */
export function FetGlyph({ t, cx, cy, ptype }: { t: string; cx: number; cy: number; ptype: "P" | "N" }) {
  const isP = ptype !== "N";
  return (
    <g className="tftnode">
      <rect x={cx - 13} y={cy - 15} width={26} height={3.4} fill="#111" />
      {isP && <circle cx={cx} cy={cy - 10.5} r={3.2} fill="#fff" stroke="#111" strokeWidth={1.6} />}
      <rect x={cx - 13} y={cy - 7} width={26} height={3.4} fill="#111" />
      <line x1={cx - 9} y1={cy - 4} x2={cx - 9} y2={cy + 16} stroke="#111" strokeWidth={1.8} />
      <line x1={cx + 9} y1={cy - 4} x2={cx + 9} y2={cy + 16} stroke="#111" strokeWidth={1.8} />
      {isP
        ? <polygon points={`${cx - 9},${cy + 2} ${cx - 12.5},${cy + 9} ${cx - 5.5},${cy + 9}`} fill="#111" />
        : <polygon points={`${cx - 9},${cy + 9} ${cx - 12.5},${cy + 2} ${cx - 5.5},${cy + 2}`} fill="#111" />}
      <text x={cx - 19} y={cy - 17} className="tftlbl">{t}</text>
    </g>
  );
}

/** Capacitor plates glyph with terminal net labels (always from netlist data). */
export function CapGlyph({ x, y, c }: { x: number; y: number; c: CapConn }) {
  const ca = NET_COLOR[c.a] || "#333", cb = NET_COLOR[c.b] || "#333";
  return (
    <g>
      <line x1={x} y1={y - 16} x2={x} y2={y - 3} stroke={ca} strokeWidth={2} />
      <line x1={x} y1={y + 3} x2={x} y2={y + 16} stroke={cb} strokeWidth={2} />
      <rect x={x - 12} y={y - 3} width={24} height={2.6} fill="#111" />
      <rect x={x - 12} y={y + 0.4} width={24} height={2.6} fill="#111" />
      <text x={x - 16} y={y - 14} className="netlbl halo" style={{ fill: ca, fontWeight: 700 }}>{c.a}</text>
      <text x={x - 16} y={y + 26} className="netlbl halo" style={{ fill: cb, fontWeight: 700 }}>{c.b}</text>
      <text x={x + 16} y={y + 4} className="tftlbl">{c.name} {c.pf}p</text>
    </g>
  );
}

export default function SchemEditor({ tft, caps, pickedNet, onPickNet, onPinClick }: Props) {
  const { lines, labels } = routeNetWires(tft);
  const toggleNet = (net: string) => onPickNet(pickedNet === net ? null : (net as Net));
  const onCaps = caps.filter((c) => c.on);
  return (
    <svg id="schem" viewBox="0 0 720 470" role="img" aria-label="driver stage schematic">
      <defs>
        <pattern id="schem-grid" width={20} height={20} patternUnits="userSpaceOnUse">
          <circle cx={1} cy={1} r={1} fill="#e4e4e4" />
        </pattern>
      </defs>
      <rect x={0} y={0} width={720} height={470} fill="url(#schem-grid)" />
      {Object.keys(RAILS).map((net) => {
        const [rx, ry] = RAILS[net];
        const c = NET_COLOR[net] || "#333";
        return (
          <g key={net} className={"pin" + (pickedNet === net ? " sel" : "")} onClick={() => toggleNet(net)}>
            <rect x={rx - 26} y={ry - 10} width={52} height={20} rx={4} fill="#fff" stroke={c} strokeWidth={1.6} />
            <text x={rx} y={ry} className="netlbl" style={{ fill: c, fontWeight: 700 }}>{net}</text>
          </g>
        );
      })}
      {lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
          stroke={l.color} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.85} />
      ))}
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} className="netlbl halo">{l.text}</text>
      ))}
      {TNAMES.filter((t) => tft[t].on).map((t) => {
        const [cx, cy] = SCHEM_POS[t];
        return (
          <g key={t}>
            <FetGlyph t={t} cx={cx} cy={cy} ptype={tft[t].type || "P"} />
            {(["G","S","D"] as Pin[]).map((pin) => {
              const [px, py] = pinXY(t, pin);
              const net = tft[t][pin];
              const c = NET_COLOR[net] || "#333";
              const sel = pickedNet === net;
              return (
                <g key={pin}>
                  <line x1={cx} y1={cy} x2={px} y2={py} stroke={c} strokeWidth={1.6} opacity={0.55} />
                  <g className={"pin" + (sel ? " sel" : "")}
                    onClick={(ev) => { ev.stopPropagation(); onPinClick(t, pin); }}>
                    <circle cx={px} cy={py} r={11} style={{ stroke: c, fill: sel ? c : "#fff" }} />
                    <text x={px} y={py} style={sel ? { fill: "#fff" } : undefined}>{pin}</text>
                  </g>
                  <text x={px} y={py + 22} className="netlbl halo" style={{ fill: c, fontWeight: 700 }}>{net}</text>
                </g>
              );
            })}
          </g>
        );
      })}
      {onCaps.map((c, i) => (
        <CapGlyph key={c.name + i} x={330 + (i % 3) * 90} y={428} c={c} />
      ))}
    </svg>
  );
}

export function NetPicker({ picked, onPick, nets }: { picked: Net | null; onPick: (n: Net | null) => void; nets?: readonly string[] }) {
  return (
    <div className="chips" id="netpick">
      {(nets || NETS).map((n) => {
        const c = NET_COLOR[n] || "#333";
        return (
          <button key={n} className={"chip" + (picked === n ? " on" : "")}
            style={{ borderLeft: `6px solid ${c}` }}
            onClick={() => onPick(picked === n ? null : (n as Net))}>{n}</button>
        );
      })}
    </div>
  );
}
