import { describe, expect, it } from "vitest";
import { EM12 } from "./circuit";
import { EM_TRACE, EM_TRACE_NOTES } from "./sources";

describe("EM source trace", () => {
  it("covers every EM TFT and cap", () => {
    const ids = EM_TRACE.map((r) => r.id);
    for (const t of Object.keys(EM12)) expect(ids).toContain(t);
    for (const c of ["C1", "C2", "C3"]) expect(ids).toContain(c);
    expect(ids).toHaveLength(15);
  });
  it("conn strings match the EM12 preset", () => {
    for (const r of EM_TRACE.filter((x) => x.id.startsWith("T"))) {
      const e = EM12[r.id];
      expect(r.conn).toBe(`G=${e.G} S=${e.S} D=${e.D}`);
    }
  });
  it("every row cites a patent device with a non-empty sentence", () => {
    for (const r of EM_TRACE) {
      expect(r.patent).toMatch(/^(M\d+|C\d)$/);
      expect(r.sentence.length).toBeGreaterThan(20);
    }
    expect(EM_TRACE_NOTES.length).toBeGreaterThanOrEqual(4);
  });
});
