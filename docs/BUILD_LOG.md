# Build log

## 2026-10-28: EM/GC/GI + 8T1C extension (90-min budget)

- 23:07 start. Inventoried gw-react + gw_lab backend (copied logic, gw_lab untouched).
- 23:08 n-type probe: `server/runs/probe_pol/` — POL=-1 off below Vg≈1V,
  conducting above → n-type with Vth=+VT0 confirmed. (First probe attempt
  failed: OSDI device needs `N` prefix, fixed.)
- 23:08–23:12 read US 11,205,374 B2 embodiment text (Google Patents) and
  mapped M1..M12/C1..C3 to T1..T12 (see CIRCUITS.md).
- 23:13 new backend `server/` (presets.py, backend.py, app.py on
  127.0.0.1:8768): caps + W/L inputs, T1..T12, N1..N8, clock_mode
  continuous(default)/burst, low/high_pulse, whole-P frame grid,
  per-stage/frame pass-fail. `ptft_fit.osdi` copied from gw_lab.
- 23:13 EM first run `server/runs/20261028_231321_e5a4ad` PASS (4 stages,
  2 frames, all levels/order/width OK). GW/GC/GI, EM 2H/8H also PASS.
- 23:14 pixel first runs FAIL (wrong bias, kept in runs/):
  `20261028_231405_f5d2e3` etc. Cause from node waveforms: T1 in linear
  region (Vsd≈0.8V), OLED RS=1.5MEG limited current → DATA 2→4V only
  3.72→3.39uA (9%), no compensation action. Bounded fix: ELVDD 7→4.6V,
  OLED RS 1.5MEG→300k (T1 into saturation), Vsense sign fix.
  Reran: DATA 2/3/4V → 4.13/1.70/0.29uA monotonic; ΔVth ±0.2V → <0.4%.
- 23:15–23:19 frontend: base `/circuit-muse/`, tabs (drivers/pixel/report),
  presets, caps editor, P-bubble/N glyphs, cap + OLED symbols, zoomable
  stacked waves, pass/fail table, netlist view + .cir download, 390px CSS.
  Tests updated only where the spec mandates (12 TFTs, 20 nets, W/L/type
  in desc, single backend URL); 34 pass, build passes.
- 23:19 `server/tests/` (11 tests) all pass; saved to SELF_CHECK.txt.
