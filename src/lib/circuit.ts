// Canonical constants + pure logic ported from the vanilla lab page.
export const NETS = ["VGH","VGL","FLM","CLK1","CLK2","A","B","C","Q","QB","OUT","IN"] as const;
export type Net = (typeof NETS)[number];
export type Pin = "G" | "S" | "D";
export type TName = `T${1|2|3|4|5|6|7|8|9}`;
export const TNAMES: TName[] = ["T1","T2","T3","T4","T5","T6","T7","T8","T9"];

export interface TftConn { G: Net; S: Net; D: Net; on: boolean; }
export type TftMap = Record<TName, TftConn>;

export const VC: Record<TName, { G: Net; S: Net; D: Net }> = {
  T1:{G:"CLK1",S:"FLM",D:"B"},T2:{G:"C",S:"VGH",D:"A"},T3:{G:"CLK2",S:"A",D:"B"},
  T4:{G:"B",S:"VGH",D:"C"},T5:{G:"CLK1",S:"QB",D:"VGL"},T6:{G:"QB",S:"VGH",D:"OUT"},
  T7:{G:"Q",S:"OUT",D:"CLK2"},T8:{G:"VGL",S:"B",D:"Q"},T9:{G:"CLK2",S:"QB",D:"C"},
};
export const BROKEN: typeof VC = JSON.parse(JSON.stringify(VC));
BROKEN.T2.D = "C";

export interface Params { vgh: number; vgl: number; res: number; freq: number; stages: number; frames: number; }
export const DEFAULT_PARAMS: Params = { vgh: 8.0, vgl: -9.5, res: 2160, freq: 250, stages: 6, frames: 2 };

export interface SimDesc extends Params { tft: Record<TName, { G: Net; S: Net; D: Net }>; }

export function presetToMap(p: typeof VC): TftMap {
  const m = {} as TftMap;
  for (const t of TNAMES) m[t] = { ...p[t], on: true };
  return m;
}

export function buildDesc(params: Params, tft: TftMap): SimDesc {
  const ts = {} as SimDesc["tft"];
  for (const t of TNAMES) if (tft[t].on) ts[t] = { G: tft[t].G, S: tft[t].S, D: tft[t].D };
  return { ...params, tft: ts };
}

export function hinfoText(freq: number): string {
  const f = freq || 250;
  return `1H = ${(1000 / f).toFixed(3)} us (주파수 ${f} kHz 라인타임)`;
}

// ---- schematic geometry (same numbers as the vanilla editor) ----
export const SCHEM_POS: Record<TName, [number, number]> =
  {T1:[90,120],T2:[260,80],T3:[260,220],T4:[430,140],T5:[90,330],T6:[570,260],T7:[450,350],T8:[260,350],T9:[440,250]};
export const RAILS: Record<string, [number, number]> =
  {VGH:[360,20],VGL:[460,20],FLM:[40,20],CLK1:[140,20],CLK2:[240,20]};
export const NET_COLOR: Record<string, string> =
  {VGH:"#c00",VGL:"#00c",FLM:"#000",CLK1:"#e80",CLK2:"#e80",OUT:"#e00"};

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
      const net = tft[t][pin];
      (netXY[net] = netXY[net] || []).push(pinXY(t, pin));
    });
  }
  const lines: { x1:number;y1:number;x2:number;y2:number;color:string }[] = [];
  const labels: { x:number;y:number;text:string }[] = [];
  for (const net of Object.keys(netXY)) {
    const pts = netXY[net];
    const col = NET_COLOR[net] || "#090";
    if (pts.length >= 2) {
      const spineY = Math.min(...pts.map((p) => p[1])) - 22;
      const xs = pts.map((p) => p[0]).sort((a, b) => a - b);
      lines.push({ x1: xs[0], y1: spineY, x2: xs[xs.length-1], y2: spineY, color: col });
      for (const [px, py] of pts) lines.push({ x1: px, y1: py - 11, x2: px, y2: spineY, color: col });
      labels.push({ x: xs[0], y: spineY - 5, text: `${net} x${pts.length}` });
    } else if (pts.length === 1 && RAILS[net]) {
      const [px, py] = pts[0];
      const [rx, ry] = RAILS[net];
      // polyline px,py-11 -> px,ry+16 -> rx,ry+16 expressed as two lines
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
  {FLM:"#000",CLK1:"#888",CLK2:"#aaa",OUT1:"#e00",OUT2:"#e60",OUT3:"#c0c",OUT4:"#060",OUT5:"#06c",OUT6:"#630",B:"#0a0",QB:"#00c",Q:"#808",A:"#e80",C:"#864"};
export const LANES: [string, string][] = [["v(FLM)","FLM"],["v(CLK1)","CLK1"],["v(CLK2)","CLK2"],
  ["v(OUT1)","OUT1"],["v(OUT2)","OUT2"],["v(OUT3)","OUT3"],["v(OUT4)","OUT4"],["v(OUT5)","OUT5"],["v(OUT6)","OUT6"],
  ["v(x1.b)","B"],["v(x1.qb)","QB"],["v(x1.q)","Q"],["v(x1.a)","A"],["v(x1.c)","C"]];

export interface Series { t_us: number[]; [k: string]: number[]; }
export interface SeriesInfo { H?: number; P?: number; T0: number; [k: string]: number | undefined; }

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
