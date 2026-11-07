// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import GbCandidatePage from "./GbCandidatePage";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("GB candidate", () => {
  it("labels synthetic topology and exposes all four comparisons", () => {
    render(<GbCandidatePage />);
    expect(screen.getByText(/원본 회로의 검증 결과가 아닙니다/)).toBeDefined();
    for (const w of [56,112]) for (const c of [0.3,1]) expect(screen.getByText(`T9 ${w} µm / C3 ${c} pF`)).toBeDefined();
  });
  it("submits selected parameters exactly once and clears old result when changed", async () => {
    const fetcher = vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({ok:true,job:"gb_test",parameters:{t9_width_um:56,c3_pf:0.3},series:{time_us:[0,400],outputs:{OUT1:[8,8]}}})});
    vi.stubGlobal("fetch",fetcher); render(<GbCandidatePage />);
    fireEvent.click(screen.getByText("T9 56 µm / C3 0.3 pF"));
    await act(async()=>fireEvent.click(screen.getByText("이 조건으로 실제 실행")));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({t9_width_um:56,c3_pf:0.3});
    expect(screen.getByText(/이번 실행:/)).toBeDefined();
    fireEvent.change(screen.getByLabelText("T9 폭 (µm)"),{target:{value:"112"}});
    expect(screen.queryByText(/이번 실행:/)).toBeNull();
  });
  it("does not show demo or retry after failure", async () => {
    const fetcher=vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch",fetcher);
    render(<GbCandidatePage />);
    await act(async()=>fireEvent.click(screen.getByText("이 조건으로 실제 실행")));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toContain("데모 파형으로 대체하지 않습니다");
    expect(screen.queryByText(/이번 실행:/)).toBeNull();
  });
  it("blocks invalid numbers and repeated clicks during pending request", async () => {
    let resolve!: (v: unknown)=>void;
    const fetcher=vi.fn(()=>new Promise(r=>{resolve=r;})); vi.stubGlobal("fetch",fetcher);
    render(<GbCandidatePage />);
    fireEvent.change(screen.getByLabelText("C3 (pF)"),{target:{value:"0"}});
    expect((screen.getByText("이 조건으로 실제 실행") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByText("T9 112 µm / C3 1 pF"));
    fireEvent.click(screen.getByText("이 조건으로 실제 실행"));
    fireEvent.click(screen.getByText("ngspice 계산 중…"));
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async()=>resolve({ok:false,status:429}));
  });
});
