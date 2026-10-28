// Canonical constants + pure logic for drivers (GW/EM/GC/GI) and pixel.
export const NETS = ["VGH","VGL","FLM","CLK1","CLK2","A","B","C","Q","QB","OUT","IN",
  "N1","N2","N3","N4","N5","N6","N7","N8"] as const;
export type Net = (typeof NETS)[number];
export type Pin = "G" | "S" | "D";
export type TName = `T${1|2|3|4|5|6|7|8|9|10|11|12}`;
export const TNAMES: TName[] =
  ["T1","T2","T3","T4","T5","T6","T7","T8","T9","T10","T11","T12"];

export interface TftConn {
  G: Net; S: Net; D: Net; on: boolean;
  W?: number; L?: number; type?: "P" | "N";
}
export type TftMap = Record<TName, TftConn>;
export interface CapConn { a: Net; b: Net; pf: number; name: string; on: boolean }

export const VC: Record<string, { G: Net; S: Net; D: Net }> = {
  T1:{G:"CLK1",S:"FLM",D:"B"},T2:{G:"C",S:"VGH",D:"A"},T3:{G:"CLK2",S:"A",D:"B"},
  T4:{G:"B",S:"VGH",D:"C"},T5:{G:"CLK1",S:"QB",D:"VGL"},T6:{G:"QB",S:"VGH",D:"OUT"},
  T7:{G:"Q",S:"OUT",D:"CLK2"},T8:{G:"VGL",S:"B",D:"Q"},T9:{G:"CLK2",S:"QB",D:"C"},
};
// EM 12T3C from Samsung Display US 11,205,374 B2 Fig.4 (M1..M12 -> T1..T12,
// VDD->VGH, VSS->VGL). N7 = unnamed M1-M2 series junction (assumption).
// GC/GI reuse this stage (assumption, see docs/CIRCUITS.md).
export const EM12: Record<string, { G: Net; S: Net; D: Net; W: number; L: number }> = {
  T1:{G:"N2",S:"VGH",D:"N7",W:8,L:4.5},T2:{G:"CLK2",S:"N7",D:"N3",W:8,L:4.5},
  T3:{G:"VGL",S:"N1",D:"N3",W:4,L:4.5},T4:{G:"N4",S:"VGH",D:"OUT",W:40,L:4.5},
  T5:{G:"N3",S:"OUT",D:"VGL",W:20,L:4.5},T6:{G:"CLK1",S:"FLM",D:"N1",W:8,L:4.5},
  T7:{G:"N1",S:"N2",D:"CLK1",W:4,L:4.5},T8:{G:"CLK1",S:"N2",D:"VGL",W:4,L:4.5},
  T9:{G:"VGL",S:"N2",D:"N5",W:4,L:4.5},T10:{G:"CLK2",S:"N6",D:"N4",W:4,L:4.5},
  T11:{G:"N5",S:"N6",D:"CLK2",W:4,L:4.5},T12:{G:"N1",S:"VGH",D:"N4",W:8,L:4.5},
};
export const BROKEN: typeof VC = JSON.parse(JSON.stringify(VC));
BROKEN.T2.D = "C";

export const GW_WL: Record<string, [number, number]> =
  {T1:[8,4.5],T2:[4,6],T3:[4,4.5],T4:[4,4.5],T5:[4,6],T6:[40,4.5],T7:[4,4.5],T8:[4,4.5],T9:[4,4.5]};

export type PresetName = "GW" | "EM" | "GC" | "GI";
export const PRESETS: PresetName[] = ["GW", "EM", "GC", "GI"];
export const PRESET_POLARITY: Record<PresetName, "low_pulse" | "high_pulse"> =
  { GW: "low_pulse", EM: "high_pulse", GC: "high_pulse", GI: "high_pulse" };
export const PRESET_WIDTH_H: Record<PresetName, number> =
  { GW: 1, EM: 4, GC: 2, GI: 2 };

export function presetTft(p: PresetName): TftMap {
  const m = {} as TftMap;
  for (const t of TNAMES) {
    const src = p === "GW" ? VC[t] : EM12[t];
    if (src) {
      const wl = p === "GW" ? GW_WL[t] : [EM12[t].W, EM12[t].L];
      m[t] = { G: src.G, S: src.S, D: src.D, on: true, W: wl[0], L: wl[1], type: "P" };
    } else m[t] = { G: "VGH", S: "VGH", D: "VGH", on: false, W: 4, L: 4.5, type: "P" };
  }
  return m;
}

export function presetCaps(p: PresetName): CapConn[] {
  if (p === "GW") return [
    { a: "VGH", b: "QB", pf: 1.0, name: "C1", on: true },
    { a: "OUT", b: "Q", pf: 0.2, name: "C2", on: true },
  ];
  return [
    { a: "N3", b: "CLK2", pf: 0.3, name: "C1", on: true },
    { a: "N5", b: "N6", pf: 0.3, name: "C2", on: true },
    { a: "VGH", b: "N4", pf: 1.0, name: "C3", on: true },
  ];
}

export interface Params {
  vgh: number; vgl: number; res: number; freq: number; stages: number; frames: number;
  clock_mode: "continuous" | "burst";
  polarity: "low_pulse" | "high_pulse";
  start_width_H: number;
}
export const DEFAULT_PARAMS: Params =
  { vgh: 8.0, vgl: -9.5, res: 2160, freq: 250, stages: 6, frames: 2,
    clock_mode: "continuous", polarity: "low_pulse", start_width_H: 1 };

export interface SimDesc extends Params {
  preset: PresetName;
  tft: Record<string, { G: Net; S: Net; D: Net; W?: number; L?: number; type?: string }>;
  caps: { a: Net; b: Net; pf: number; name: string }[];
}

export function presetToMap(p: Record<string, { G: Net; S: Net; D: Net }>): TftMap {
  const m = {} as TftMap;
  for (const t of TNAMES) {
    if (p[t]) {
      const wl = GW_WL[t] || [4, 4.5];
      m[t] = { ...p[t], on: true, W: wl[0], L: wl[1], type: "P" };
    } else m[t] = { G: "VGH", S: "VGH", D: "VGH", on: false, W: 4, L: 4.5, type: "P" };
  }
  return m;
}

export function buildDesc(params: Params, tft: TftMap, preset: PresetName = "GW",
    caps: CapConn[] = []): SimDesc {
  const ts = {} as SimDesc["tft"];
  for (const t of TNAMES)
    if (tft[t].on)
      ts[t] = { G: tft[t].G, S: tft[t].S, D: tft[t].D,
        W: tft[t].W, L: tft[t].L, type: tft[t].type || "P" };
  return { ...params, preset, tft: ts,
    caps: caps.filter((c) => c.on).map((c) => ({ a: c.a, b: c.b, pf: c.pf, name: c.name })) };
}

export function hinfoText(freq: number): string {
  const f = freq || 250;
  return `1H = ${(1000 / f).toFixed(3)} us (주파수 ${f} kHz 라인타임)`;
}

// ---- schematic geometry ----
export const SCHEM_POS: Record<TName, [number, number]> =
  {T1:[90,120],T2:[260,80],T3:[260,220],T4:[430,140],T5:[90,330],T6:[570,260],T7:[450,350],T8:[260,350],T9:[440,250],
   T10:[580,90],T11:[90,220],T12:[580,370]};
export const RAILS: Record<string, [number, number]> =
  {VGH:[360,20],VGL:[460,20],FLM:[40,20],CLK1:[140,20],CLK2:[240,20]};
export const NET_COLOR: Record<string, string> =
  {VGH:"#c00000",VGL:"#0050c0",FLM:"#555555",CLK1:"#e68a00",CLK2:"#a67c00",
   A:"#8040c0",B:"#0a8a0a",C:"#6d4c41",Q:"#00a0b0",QB:"#d0006e",OUT:"#ff0000",IN:"#666666",
   N1:"#2e7d32",N2:"#9c27b0",N3:"#ef6c00",N4:"#00838f",N5:"#5d4037",N6:"#1565c0",N7:"#ad1457",N8:"#33691e"};

export function pinXY(t: TName, pin: Pin): [number, number] {
  const [cx, cy] = SCHEM_POS[t];
  if (pin === "G") return [cx, cy - 36];
  if (pin === "S") return [cx - 36, cy + 14];
  return [cx + 36, cy + 14];
}

/** Same-net Manhattan spine routing. Returns lines + one label per multi-pin net. */
export function routeNetWires(tft: TftMap): { lines: { x1:number;y1:number;x2:number;y2:number;color:string }[]; labels: { x:number;y:number;text:string }[] } {
  const netXY: Record<string, [number, number][]> = {};
  for (const t of TNAMES) {
    if (!tft[t].on) continue;
    (["G","S","D"] as Pin[]).forEach((pin) => {
      const net = tft[t][pin] as string;
      (netXY[net] = netXY[net] || []).push(pinXY(t, pin));
    });
  }
  return routeSpines(netXY);
}

export function routeSpines(netXY: Record<string, [number, number][]>):
    { lines: { x1:number;y1:number;x2:number;y2:number;color:string }[]; labels: { x:number;y:number;text:string }[] } {
  const lines: { x1:number;y1:number;x2:number;y2:number;color:string }[] = [];
  const labels: { x:number;y:number;text:string }[] = [];
  for (const net of Object.keys(netXY)) {
    const pts = netXY[net];
    const col = NET_COLOR[net] || "#333";
    if (pts.length >= 2) {
      const spineY = Math.min(...pts.map((p) => p[1])) - 22;
      const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
      lines.push({ x1: xs[0], y1: spineY, x2: xs[xs.length-1], y2: spineY, color: col });
      for (const [px, py] of pts) lines.push({ x1: px, y1: py - 11, x2: px, y2: spineY, color: col });
      labels.push({ x: xs[0], y: spineY - 5, text: `${net} x${pts.length}` });
    } else if (pts.length === 1 && RAILS[net]) {
      const [px, py] = pts[0];
      const [rx, ry] = RAILS[net];
      lines.push({ x1: px, y1: py - 11, x2: px, y2: ry + 16, color: NET_COLOR[net] || "#333" });
      lines.push({ x1: px, y1: ry + 16, x2: rx, y2: ry + 16, color: NET_COLOR[net] || "#333" });
    }
  }
  return { lines, labels };
}

export function schemInfoText(tft: TftMap): string {
  const bad = TNAMES.filter((t) => tft[t].on && !(tft[t].G && tft[t].S && tft[t].D));
  return "현재: " + TNAMES.filter((t) => tft[t].on).map((t) => `${t}(${tft[t].G}/${tft[t].S}/${tft[t].D})`).join(" ") +
    (bad.length ? " / 미지정: " + bad.join(",") : "") + " / 넷 버튼 선택 후 핀을 누르면 직접 붙습니다.";
}

// ---- waveform lanes ----
export const COLORS: Record<string, string> =
  {FLM:"#000",CLK1:"#888",CLK2:"#aaa",OUT1:"#e00",OUT2:"#e60",OUT3:"#c0c",OUT4:"#060",OUT5:"#06c",OUT6:"#630",
   OUT7:"#909",OUT8:"#066",OUT9:"#960",OUT10:"#609",OUT11:"#096",OUT12:"#906",
   B:"#0a0",QB:"#00c",Q:"#808",A:"#e80",C:"#864",
   N1:"#2e7d32",N2:"#9c27b0",N3:"#ef6c00",N4:"#00838f",N5:"#5d4037",N6:"#1565c0",N7:"#ad1457",N8:"#33691e",
   GI:"#2e7d32",GC:"#9c27b0",GW:"#e60",EM:"#e00",GO:"#06c",NG:"#00a0b0",NS:"#8040c0",ND:"#6d4c41",
   ANODE:"#ff0000","I_OLED":"#000",DATA:"#555"};
export const LANES: [string, string][] = [["v(FLM)","FLM"],["v(CLK1)","CLK1"],["v(CLK2)","CLK2"],
  ["v(OUT1)","OUT1"],["v(OUT2)","OUT2"],["v(OUT3)","OUT3"],["v(OUT4)","OUT4"],["v(OUT5)","OUT5"],["v(OUT6)","OUT6"],
  ["v(x1.b)","B"],["v(x1.qb)","QB"],["v(x1.q)","Q"],["v(x1.a)","A"],["v(x1.c)","C"]];

export function driverLanes(stages: number, internals: string[]): [string, string][] {
  const lanes: [string, string][] = [["v(FLM)","FLM"],["v(CLK1)","CLK1"],["v(CLK2)","CLK2"]];
  for (let i = 1; i <= stages; i++) lanes.push([`v(OUT${i})`, `OUT${i}`]);
  for (const n of internals) lanes.push([`v(x1.${n})`, n.toUpperCase()]);
  return lanes;
}

export const PIXEL_LANES: [string, string][] = [
  ["v(gi)","GI"],["v(gc)","GC"],["v(gw)","GW"],["v(em)","EM"],["v(go)","GO"],
  ["v(ng)","NG"],["v(ns)","NS"],["v(nd)","ND"],["v(anode)","ANODE"],["i(oled)","I_OLED"]];

export interface Series { t_us: number[]; [k: string]: number[]; }
export interface SeriesInfo {
  H?: number; P?: number; T0: number; T0s?: number[]; frame_period?: number;
  frame_us?: number; TEND?: number; internals?: string[];
  [k: string]: number | number[] | string[] | undefined;
}

/** H-normalized plot window: same math as the vanilla drawPlot. */
export function plotWindow(t: number[], info: SeriesInfo): { H: number; t0: number; t1: number; i0: number; i1: number } {
  const H = info.H || (info.P ? info.P / 2 : 8);
  const t0 = info.T0 - 1 * H, t1 = info.T0 + 8 * H;
  let i0 = 0, i1 = t.length - 1;
  for (let i = 0; i < t.length; i++) { if (t[i] < t0) i0 = i; if (t[i] <= t1) i1 = i; }
  return { H, t0, t1, i0, i1 };
}

export function axisLabel(info: SeriesInfo, H: number, t0: number, t1: number): string {
  const ax0 = ((t0 - info.T0) / H).toFixed(1), ax1 = ((t1 - info.T0) / H).toFixed(1);
  return `T0+${ax0}H ~ T0+${ax1}H  (${t0.toFixed(2)} ~ ${t1.toFixed(2)} us, H=${H.toFixed(3)}us)`;
}

// ---- pass/fail ----
export interface StageCheck {
  pulses: number; pass: boolean; reasons: string[];
  t_start?: number; width_us?: number; width_H?: number; extreme?: number;
}
export interface PassFail { stages: Record<string, StageCheck>; pass: boolean; reasons: string[] }

// ---- pixel ----
export const P_NETS = ["ELVDD","ELVSS","VINT","VOBS","DATA","VGH","VGL",
  "GI","GC","GW","EM","GO","NG","NS","ND","ANODE"] as const;
export type PNet = (typeof P_NETS)[number];
export type PTft = `T${1|2|3|4|5|6|7|8}`;
export const P_TFTS: PTft[] = ["T1","T2","T3","T4","T5","T6","T7","T8"];
export interface PTftConn { type: "P" | "N"; G: PNet; S: PNet; D: PNet; W: number; L: number; dVth: number }
export type PTftMap = Record<PTft, PTftConn>;
export interface PixelParams {
  ELVDD: number; ELVSS: number; VINT: number; VOBS: number; DATA: number;
  VGH: number; VGL: number; frame_hz: number; Cst_pf: number; Coled_pf: number;
  VT0_P: number; VT0_N: number;
  timing: Record<"GI"|"GC"|"GW"|"EM"|"GO", [number, number]>;
}
export const DEFAULT_PIXEL: PixelParams = {
  ELVDD: 4.6, ELVSS: 0, VINT: -2, VOBS: 5, DATA: 3,
  VGH: 8, VGL: -9.5, frame_hz: 120, Cst_pf: 0.2, Coled_pf: 1.0,
  VT0_P: 1.1, VT0_N: 1.1,
  timing: { GI: [0, 30], GO: [40, 70], GW: [80, 110], GC: [80, 110], EM: [150, 8300] },
};
export const DEFAULT_PTFT: PTftMap = {
  T1: { type: "P", G: "NG", S: "NS", D: "ND", W: 3, L: 6, dVth: 0 },
  T2: { type: "P", G: "GW", S: "DATA", D: "NS", W: 3, L: 4.5, dVth: 0 },
  T3: { type: "N", G: "GC", S: "NG", D: "ND", W: 3, L: 4.5, dVth: 0 },
  T4: { type: "N", G: "GI", S: "VINT", D: "NG", W: 3, L: 4.5, dVth: 0 },
  T5: { type: "P", G: "EM", S: "ELVDD", D: "NS", W: 6, L: 4.5, dVth: 0 },
  T6: { type: "P", G: "EM", S: "ND", D: "ANODE", W: 6, L: 4.5, dVth: 0 },
  T7: { type: "P", G: "GW", S: "VINT", D: "ANODE", W: 3, L: 4.5, dVth: 0 },
  T8: { type: "P", G: "GO", S: "VOBS", D: "NS", W: 3, L: 4.5, dVth: 0 },
};
// Pixel schematic positions (viewBox 720x470).
export const PIXEL_POS: Record<PTft, [number, number]> =
  {T1:[300,180],T2:[140,120],T3:[430,120],T4:[560,120],T5:[140,260],T6:[430,300],T7:[560,300],T8:[300,340]};
export const PIXEL_RAILS: Record<string, [number, number]> =
  {ELVDD:[80,20],ELVSS:[640,20],VINT:[200,20],VOBS:[320,20],DATA:[440,20],VGH:[520,20],VGL:[590,20]};
