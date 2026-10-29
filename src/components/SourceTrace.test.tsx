// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import SourceTrace from "./SourceTrace";

afterEach(cleanup);

describe("SourceTrace", () => {
  it("renders the 15-row patent table for EM", () => {
    render(<SourceTrace preset="EM" />);
    expect(screen.getByText(/US 11,205,374 B2/)).toBeDefined();
    expect(document.querySelectorAll("#tracetab tbody tr")).toHaveLength(15);
  });
  it("shows the reuse note for GC", () => {
    render(<SourceTrace preset="GC" />);
    expect(screen.getByText(/reuse the EM 12T3C stage/)).toBeDefined();
    expect(document.querySelectorAll("#tracetab tbody tr")).toHaveLength(15);
  });
  it("honestly reports no trace for GW", () => {
    render(<SourceTrace preset="GW" />);
    expect(document.getElementById("tracetab")).toBeNull();
    expect(screen.getByText(/특허 문장 단위 근거 추적을 제공하지 않습니다/)).toBeDefined();
  });
});
