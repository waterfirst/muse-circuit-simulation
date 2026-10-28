import { describe, expect, it } from "vitest";
import demo from "./data/demo.json";
import gw7t from "./data/gw7t.json";

describe("demo data", () => {
  it("all series share the time axis", () => {
    const n = demo.series.t_us.length;
    expect(n).toBeGreaterThan(1000);
    for (const [k, v] of Object.entries(demo.series)) {
      expect((v as number[]).length, k).toBe(n);
    }
  });
  it("window sits inside the axis", () => {
    const { H, T0, TEND } = demo.info;
    expect(T0 - H).toBeGreaterThanOrEqual(demo.series.t_us[0]);
    expect(T0 + 8 * H).toBeLessThanOrEqual(TEND);
  });
});

describe("gw7t report data", () => {
  it("all series share the time axis", () => {
    const n = gw7t.series.t_us.length;
    for (const [k, v] of Object.entries(gw7t.series)) {
      expect((v as number[]).length, k).toBe(n);
    }
  });
  it("every lane key exists in series", () => {
    const series = gw7t.series as Record<string, number[]>;
    for (const [key] of gw7t.lanes as [string, string, string][]) {
      expect(series[key]).toBeDefined();
    }
  });
});
