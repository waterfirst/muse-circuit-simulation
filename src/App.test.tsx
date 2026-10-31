// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import App from "./App";
import { LangProvider } from "./lib/i18n";

const ui = () => <LangProvider><App /></LangProvider>;

afterEach(() => {
  cleanup();
  window.location.hash = "";
  vi.unstubAllGlobals();
});

describe("report page (default)", () => {
  it("shows the GW 7T analysis report first", () => {
    render(ui());
    expect(screen.getByText("GW 7T new circuit simulation (all PMOS, 6 stages, 2 frames, 250kHz)")).toBeDefined();
    expect(screen.getByText("OUT summary (6 stages)")).toBeDefined();
    expect(screen.getByText("T2 gate comparison (original vs rework)")).toBeDefined();
    expect(document.getElementById("plot")).toBeDefined();
    expect(document.querySelectorAll("svg.schem")).toHaveLength(1);
  });
});
describe("lab page", () => {
  it("renders header, table, schematic and plot", () => {
    window.location.hash = "#/drv";
    render(ui());
    expect(screen.getByText("Driver lab — GW / EM / GC / GI")).toBeDefined();
    expect(document.getElementById("tfttab")).toBeDefined();
    expect(document.getElementById("schem")).toBeDefined();
    expect(document.getElementById("plot")).toBeDefined();
    // 12 TFT rows + header
    expect(document.querySelectorAll("#tfttab tr")).toHaveLength(13);
  });
  it("loads the VC preset by default", () => {
    window.location.hash = "#/drv";
    render(ui());
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T1(CLK1/FLM/B)");
    expect(info).toContain("T2(C/VGH/A)");
  });
  it("broken preset flips T2.D to C", () => {
    window.location.hash = "#/drv";
    render(ui());
    fireEvent.click(screen.getByText("Broken example (A floating)"));
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T2(C/VGH/C)");
  });
  it("table edit syncs to the schematic info", () => {
    window.location.hash = "#/drv";
    render(ui());
    const selects = document.querySelectorAll("#tfttab select");
    fireEvent.change(selects[0], { target: { value: "VGL" } });
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).toContain("T1(VGL/FLM/B)");
  });
  it("unchecking a TFT drops it from the info", () => {
    window.location.hash = "#/drv";
    render(ui());
    const boxes = document.querySelectorAll('#tfttab input[type="checkbox"]');
    fireEvent.click(boxes[8]);
    const info = document.getElementById("scheminfo")?.textContent ?? "";
    expect(info).not.toContain("T9(");
  });
  it("lane chips toggle", () => {
    window.location.hash = "#/drv";
    render(ui());
    const chip = screen.getByText("OUT6", { selector: "#lanes .chip" });
    expect(chip.className).toContain("on");
    fireEvent.click(chip);
    expect(chip.className).not.toContain("on");
  });
  it("failed backends fall back to the demo series", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    window.location.hash = "#/drv";
    render(ui());
    await act(async () => {
      fireEvent.click(screen.getByText("Run simulation"));
    });
    expect(document.getElementById("status")?.textContent).toContain("Demo waveform");
    expect(document.getElementById("summary")?.textContent).toContain("stored verification waveform");
  });
});

describe("schematic", () => {
  it("renders 9 FET glyphs with net-colored pins", () => {
    window.location.hash = "#/drv";
    render(ui());
    expect(document.querySelectorAll("#schem .tftnode")).toHaveLength(9);
    // 9 TFT labels + 2 cap labels
    expect(document.querySelectorAll("#schem .tftlbl")).toHaveLength(11);
    // 9 TFTs x 3 pins + 5 rails
    expect(document.querySelectorAll("#schem g.pin")).toHaveLength(32);
    const circles = document.querySelectorAll("#schem g.pin circle");
    const strokes = new Set(Array.from(circles).map((c) => (c as SVGCircleElement).style.stroke));
    expect(strokes.size).toBeGreaterThan(5);
  });
  it("net picker chips carry color edges", () => {
    window.location.hash = "#/drv";
    render(ui());
    const chips = document.querySelectorAll("#netpick .chip");
    expect(chips).toHaveLength(20);
    expect((chips[0] as HTMLElement).style.borderLeft).toContain("6px solid");
  });
});

describe("report page", () => {
  it("renders on #/gw7t with tables and canvas", () => {
    window.location.hash = "#/gw7t";
    render(ui());
    expect(screen.getByText("OUT summary (6 stages)")).toBeDefined();
    expect(screen.getByText("T2 gate comparison (original vs rework)")).toBeDefined();
    expect(document.getElementById("plot")).toBeDefined();
    expect(document.querySelectorAll("svg.schem")).toHaveLength(1);
  });
  it("lab links to the report", () => {
    window.location.hash = "#/drv";
    render(ui());
    expect(screen.getByText("GW 7T report").getAttribute("href")).toBe("#/");
  });
  it("tabs switch to the pixel page", () => {
    render(ui());
    expect(screen.getByText("Pixel (8T1C)").getAttribute("href")).toBe("#/pixel");
  });
});
