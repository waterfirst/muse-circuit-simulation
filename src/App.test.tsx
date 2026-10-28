// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

describe("lab page", () => {
  it("renders header, table, schematic and plot", () => {
    render(<App />);
    expect(screen.getByText("GW Lab - 넷리스트 실험실")).toBeDefined();
    expect(document.getElementById("tfttab")).toBeDefined();
    expect(document.getElementById("schem")).toBeDefined();
    expect(document.getElementById("plot")).toBeDefined();
    // 9 TFT rows + header
    expect(document.querySelectorAll("#tfttab tr")).toHaveLength(10);
  });
  it("loads the VC preset by default", () => {
    render(<App />);
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T1(CLK1/FLM/B)");
    expect(info).toContain("T2(C/VGH/A)");
  });
  it("broken preset flips T2.D to C", () => {
    render(<App />);
    fireEvent.click(screen.getByText("고장 예시 (A 플로팅)"));
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T2(C/VGH/C)");
  });
  it("table edit syncs to the schematic info", () => {
    render(<App />);
    const selects = document.querySelectorAll("#tfttab select");
    fireEvent.change(selects[0], { target: { value: "VGL" } });
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T1(VGL/FLM/B)");
  });
  it("unchecking a TFT drops it from the info", () => {
    render(<App />);
    const boxes = document.querySelectorAll('#tfttab input[type="checkbox"]');
    fireEvent.click(boxes[8]);
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).not.toContain("T9(");
  });
  it("lane chips toggle", () => {
    render(<App />);
    const chip = screen.getByText("OUT6", { selector: "#lanes .chip" });
    expect(chip.className).toContain("on");
    fireEvent.click(chip);
    expect(chip.className).not.toContain("on");
  });
  it("failed backends fall back to the demo series", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    render(<App />);
    await act(async () => {
      fireEvent.click(screen.getByText("시뮬레이션 실행"));
    });
    expect(document.getElementById("status")?.textContent).toContain("서버에 닿지 않아");
    expect(document.getElementById("summary")?.textContent).toContain("vC 검증 파형");
  });
});

describe("report page", () => {
  it("renders on #/gw7t with tables and canvas", () => {
    window.location.hash = "#/gw7t";
    render(<App />);
    expect(screen.getByText("OUT 요약 (6단)")).toBeDefined();
    expect(screen.getByText("T2 게이트 비교 (원안 vs 개조)")).toBeDefined();
    expect(document.getElementById("plot")).toBeDefined();
    expect(document.querySelectorAll("svg.schem")).toHaveLength(1);
  });
  it("lab links to the report", () => {
    render(<App />);
    expect(screen.getByText("GW 7T 확정 리포트 (회로도+파형)").getAttribute("href")).toBe("#/gw7t");
  });
});
