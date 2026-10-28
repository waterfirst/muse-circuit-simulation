import { describe, expect, it } from "vitest";
import { BROKEN, DEFAULT_PARAMS, LANES, NETS, TNAMES, VC, axisLabel, buildDesc,
  hinfoText, pinXY, plotWindow, presetToMap, routeNetWires, schemInfoText } from "./circuit";

describe("presets", () => {
  it("VC has 9 TFTs with valid nets", () => {
    for (const t of TNAMES) {
      expect(NETS).toContain(VC[t].G);
      expect(NETS).toContain(VC[t].S);
      expect(NETS).toContain(VC[t].D);
    }
  });
  it("BROKEN differs from VC only at T2.D", () => {
    for (const t of TNAMES) {
      if (t === "T2") expect(BROKEN.T2.D).toBe("C");
      else expect(BROKEN[t]).toEqual(VC[t]);
    }
    expect(VC.T2.D).toBe("A");
  });
  it("presetToMap enables everything", () => {
    const m = presetToMap(VC);
    for (const t of TNAMES) expect(m[t].on).toBe(true);
  });
});

describe("buildDesc", () => {
  it("includes params and only enabled TFTs", () => {
    const m = presetToMap(VC);
    m.T9.on = false;
    const d = buildDesc(DEFAULT_PARAMS, m);
    expect(d.vgh).toBe(8.0);
    expect(d.stages).toBe(6);
    expect(Object.keys(d.tft)).toHaveLength(8);
    expect(d.tft.T1).toEqual({ G: "CLK1", S: "FLM", D: "B" });
  });
});

describe("hinfoText", () => {
  it("matches the vanilla format", () => {
    expect(hinfoText(250)).toBe("1H = 4.000 us (주파수 250 kHz 라인타임)");
    expect(hinfoText(NaN)).toContain("250 kHz");
  });
});

describe("schematic", () => {
  it("pin positions match the vanilla numbers", () => {
    expect(pinXY("T1", "G")).toEqual([90, 84]);
    expect(pinXY("T1", "S")).toEqual([54, 134]);
    expect(pinXY("T6", "D")).toEqual([606, 274]);
  });
  it("routes VGH spine across its pins", () => {
    const { lines, labels } = routeNetWires(presetToMap(VC));
    expect(lines.length).toBeGreaterThan(10);
    expect(labels.some((l) => l.text.startsWith("VGH x"))).toBe(true);
  });
  it("info text lists enabled TFTs", () => {
    const t = schemInfoText(presetToMap(VC));
    expect(t).toContain("T1(CLK1/FLM/B)");
    expect(t).toContain("T9(CLK2/QB/C)");
  });
});

describe("plot window", () => {
  it("uses T0-1H..T0+8H", () => {
    const t = Array.from({ length: 145 }, (_, i) => i);
    const w = plotWindow(t, { H: 4.0, T0: 40.0 });
    expect(w.H).toBe(4.0);
    expect(w.t0).toBe(36);
    expect(w.t1).toBe(72);
    expect(w.i0).toBe(35);
    expect(w.i1).toBe(72);
  });
  it("falls back to P/2 then 8", () => {
    const t = [0, 1, 2];
    expect(plotWindow(t, { P: 10, T0: 0 }).H).toBe(5);
    expect(plotWindow(t, { T0: 0 }).H).toBe(8);
  });
  it("axis label matches vanilla", () => {
    expect(axisLabel({ T0: 40 }, 4, 36, 72))
      .toBe("T0+-1.0H ~ T0+8.0H  (36.00 ~ 72.00 us, H=4.000us)");
  });
});

describe("lanes", () => {
  it("has 14 lanes starting at FLM", () => {
    expect(LANES).toHaveLength(14);
    expect(LANES[0]).toEqual(["v(FLM)", "FLM"]);
  });
});
