import { describe, expect, it, vi, afterEach } from "vitest";
import { BACKENDS, tryBackend } from "./api";
import { DEFAULT_PARAMS, presetToMap, VC, buildDesc } from "./circuit";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("tryBackend", () => {
  it("posts to the local backend and returns its reply", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true, job: "j1" }));
    vi.stubGlobal("fetch", fetch);
    const j = await tryBackend(buildDesc(DEFAULT_PARAMS, presetToMap(VC)), 50);
    expect(j).toEqual({ ok: true, job: "j1" });
    expect(BACKENDS).toEqual(["http://127.0.0.1:8768"]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(BACKENDS[0] + "/api/sim");
  });
  it("accepts 422 validation replies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(
      jsonResponse({ ok: false, errors: ["bad"] }, 422)));
    const j = await tryBackend(buildDesc(DEFAULT_PARAMS, presetToMap(VC)), 50);
    expect(j?.ok).toBe(false);
  });
  it("returns null when all backends fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const j = await tryBackend(buildDesc(DEFAULT_PARAMS, presetToMap(VC)), 10);
    expect(j).toBeNull();
  });
  it("prefers same-origin /api when served over http(s)", async () => {
    vi.resetModules();
    vi.stubGlobal("document", { baseURI: "https://waterfirst.pro/circuit2/" });
    const api = await import("./api");
    expect(api.BACKENDS[0]).toBe("https://waterfirst.pro/circuit2");
    expect(api.BACKENDS).toContain("http://127.0.0.1:8768");
  });
  it("falls back to localhost when same-origin 404s", async () => {
    vi.resetModules();
    vi.stubGlobal("document", { baseURI: "https://waterfirst.pro/circuit2/" });
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 404))
      .mockResolvedValueOnce(jsonResponse({ ok: true, job: "j2" }));
    vi.stubGlobal("fetch", fetch);
    const api = await import("./api");
    const j = await api.tryBackend(buildDesc(DEFAULT_PARAMS, presetToMap(VC)), 50);
    expect(j).toEqual({ ok: true, job: "j2" });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "https://waterfirst.pro/circuit2/api/sim");
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe(
      "http://127.0.0.1:8768/api/sim");
  });
  it("posts the desc as JSON", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetch);
    await tryBackend(buildDesc(DEFAULT_PARAMS, presetToMap(VC)), 50);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.body as string)).toContain('"stages":6');
    expect((init?.body as string)).toContain('"T1":{"G":"CLK1"');
  });
});
