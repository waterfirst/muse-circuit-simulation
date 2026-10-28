import { NET_COLOR, PIXEL_POS, PIXEL_RAILS, P_TFTS,
  type Pin, type PTft, type PTftMap } from "../lib/circuit";
import { CapGlyph, FetGlyph } from "./SchemEditor";

const PCOLOR: Record<string, string> = {
  ...NET_COLOR, ELVDD: "#c00000", ELVSS: "#0050c0", VINT: "#2e7d32", VOBS: "#9c27b0",
  DATA: "#555555", GI: "#2e7d32", GC: "#9c27b0", GW: "#e68a00", EM: "#ff0000",
  GO: "#0050c0", NG: "#00a0b0", NS: "#8040c0", ND: "#6d4c41", ANODE: "#ff0000",
};

function pinXY(t: PTft, pin: Pin): [number, number] {
  const [cx, cy] = PIXEL_POS[t];
  if (pin === "G") return [cx, cy - 36];
  if (pin === "S") return [cx - 36, cy + 14];
  return [cx + 36, cy + 14];
}

/** OLED: diode triangle + cathode bar + light arrows. */
function OledGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <polygon points={`${x},${y - 14} ${x - 12},${y + 6} ${x + 12},${y + 6}`} fill="#fff" stroke="#111" strokeWidth={2} />
      <rect x={x - 12} y={y + 6} width={24} height={3} fill="#111" />
      <line x1={x} y1={y - 26} x2={x} y2={y - 14} stroke="#ff0000" strokeWidth={2} />
      <line x1={x} y1={y + 9} x2={x} y2={y + 22} stroke="#0050c0" strokeWidth={2} />
      <line x1={x + 16} y1={y - 12} x2={x + 26} y2={y - 24} stroke="#e68a00" strokeWidth={1.6} />
      <polygon points={`${x + 26},${y - 24} ${x + 21},${y - 22} ${x + 24},${y - 19}`} fill="#e68a00" />
      <line x1={x + 8} y1={y - 8} x2={x + 18} y2={y - 20} stroke="#e68a00" strokeWidth={1.6} />
      <polygon points={`${x + 18},${y - 20} ${x + 13},${y - 18} ${x + 16},${y - 15}`} fill="#e68a00" />
      <text x={x - 34} y={y - 22} className="netlbl halo" style={{ fill: "#ff0000", fontWeight: 700 }}>ANODE</text>
      <text x={x - 34} y={y + 24} className="netlbl halo" style={{ fill: "#0050c0", fontWeight: 700 }}>ELVSS</text>
      <text x={x + 30} y={y + 4} className="tftlbl">OLED</text>
    </g>
  );
}

export default function PixelSchem({ tft, cst, coled }: { tft: PTftMap; cst: number; coled: number }) {
  // spine routing from live TFT data (drawing always matches netlist inputs)
  const netXY: Record<string, [number, number][]> = {};
  for (const t of P_TFTS)
    (["G", "S", "D"] as Pin[]).forEach((pin) => {
      const net = tft[t][pin] as string;
      (netXY[net] = netXY[net] || []).push(pinXY(t, pin));
    });
  const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
  const labels: { x: number; y: number; text: string }[] = [];
  for (const net of Object.keys(netXY)) {
    const pts = netXY[net];
    const col = PCOLOR[net] || "#333";
    if (pts.length >= 2) {
      const spineY = Math.min(...pts.map((p) => p[1])) - 22;
      const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
      lines.push({ x1: xs[0], y1: spineY, x2: xs[xs.length - 1], y2: spineY, color: col });
      for (const [px, py] of pts) lines.push({ x1: px, y1: py - 11, x2: px, y2: spineY, color: col });
      labels.push({ x: xs[0], y: spineY - 5, text: `${net} x${pts.length}` });
    }
  }
  return (
    <svg id="schem" viewBox="0 0 720 470" role="img" aria-label="8T1C pixel schematic">
      <rect x={0} y={0} width={720} height={470} fill="#fff" />
      {Object.keys(PIXEL_RAILS).map((net) => {
        const [rx, ry] = PIXEL_RAILS[net];
        const c = PCOLOR[net] || "#333";
        return (
          <g key={net}>
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
      {P_TFTS.map((t) => {
        const [cx, cy] = PIXEL_POS[t];
        return (
          <g key={t}>
            <FetGlyph t={`${t}(${tft[t].type})`} cx={cx} cy={cy} ptype={tft[t].type} />
            {(["G", "S", "D"] as Pin[]).map((pin) => {
              const [px, py] = pinXY(t, pin);
              const net = tft[t][pin] as string;
              const c = PCOLOR[net] || "#333";
              return (
                <g key={pin}>
                  <line x1={cx} y1={cy} x2={px} y2={py} stroke={c} strokeWidth={1.6} opacity={0.55} />
                  <circle cx={px} cy={py} r={9} fill="#fff" stroke={c} strokeWidth={1.4} />
                  <text x={px} y={py} className="netlbl" style={{ textAnchor: "middle" }}>{pin}</text>
                  <text x={px} y={py + 21} className="netlbl halo" style={{ fill: c, fontWeight: 700 }}>{net}</text>
                </g>
              );
            })}
          </g>
        );
      })}
      <CapGlyph x={480} y={210} c={{ a: "NG" as never, b: "ELVDD" as never, pf: cst, name: "Cst", on: true }} />
      <CapGlyph x={620} y={210} c={{ a: "ANODE" as never, b: "ELVSS" as never, pf: coled, name: "Coled", on: true }} />
      <OledGlyph x={620} y={400} />
    </svg>
  );
}
