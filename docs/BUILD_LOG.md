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

## 2026-10-28 (cont.): degradation, temperature, stress, margin, perf (120-min budget)

- 23:51 start. Prior session had delivered core/presets/pixel/UI; missing: model
  compile, §4 aging, portability, extended self-check.
- Model: copied `ptft_fit.va` to `models/` (md5 633712de…), compiled with local
  OpenVAF via new `scripts/build_model.sh` → `server/ptft_fit.osdi` is
  BYTE-IDENTICAL to `~/gw_lab/ptft_fit.osdi` (md5 93343937…, frozen in
  `models/.gwlab_md5`). Read equations: NO temperature term ($vt fixed
  300.15K) → temperature applied externally in `backend.eff_params`.
  One-device I–V probes both polarities: `server/runs/probe_p/` (P: off at
  Vg≈Vs, on for Vsg>1.1V), `server/runs/probe_n/` (N: off <1V, on above).
- Backend §4: per-TFT dVth/ion/ioff/ss + temp_C for driver and pixel
  (regression: EM 4H→3.01H, pixel 1.6998uA unchanged at fresh/25°C);
  new `server/aging.py` (BTS stress estimator + background VGH×VGL margin
  maps); new endpoints `/api/stress`, `/api/margin` (POST start 202 + GET
  poll). Fixed a SIM_LOCK re-entrancy deadlock (Semaphore is not re-entrant;
  margin workers lock per cell instead). First stress coefficients gave
  absurd dVth≈60V (Arrhenius×time×bias product); retuned to A_P=0.005,
  A_N=0.003, Ea=0.35eV → typical 0.2–2V at 85°C/500h.
- Degraded cases (kept runs): uniform dVth≤1V still passed (circuits robust).
  EM T3/T9 crippled (dVth=1.5, ion=0.15) FAILS at nominal
  (`20261029_000424_fdd306`: OUT1 high −0.68V) and PASSES at VGL=−11
  (`20261029_000429_d544a2`). Node waveforms: nominal N4 stuck +4.3..+8.2V
  (T4 never on); at VGL=−11, N4 pulls to −9.6V (crippled always-on T3/T9
  regain overdrive, N4 control restored, OUT1 → 8.03V). Max-uniform
  (dVth=2, ion=0.1, ioff=100, ss=3) FAILS at nominal and every corner
  (`20261029_000433_b69af9` etc.): N4 stuck +7.3..+8.5V, OUT flat
  −9.5..−8.7V — no switching anywhere, rails cannot restore gain.
- Perf §0.8: single EM 4.2s; 2× parallel 24–32s each; 4× parallel hit the
  300s timeout (3 of 4, `runs/20261029_000610_*` kept as evidence). Cause:
  Ubuntu ngspice-45.2 spawns 8 OpenMP threads per run (code-level
  omp_set_num_threads, ignores OMP_NUM_THREADS), burning 31s CPU for 4s wall
  (measured rusage); host is also saturated by others (load 12–19).
  Fix: `OMP_THREAD_LIMIT=1` in `_run_ngspice` env → 1.0s/sim, 4× parallel
  all ~1s, results bit-identical (EM 3.01H, pixel 1.6998uA). Margin workers
  stay sequential via SIM_LOCK (safe on shared boxes).
- Schematics §5: programmatic check — every preset TFT G/S/D + cap in the
  generated subckt equals `presets.py` (jobs `20261029_001710_*`, zero
  mismatches; first run flagged EM C1 only due to a checker-side CLK→CKB
  naming bug, netlist was correct). Frontend constants (VC/EM12/caps) ==
  backend presets, all match. Added W/L labels to FET glyphs (were missing).
  Drawings render from the same desc data as the netlist (pins always carry
  net-name tags, so user edits stay correct).
- Frontend §4: ΔVth/Ion/Ioff/SS columns + temp inputs (non-fresh cells
  yellow), shared StressPanel (temp/hours/advanced coefs/table/apply with
  ±2V clamp) and MarginPanel (lists/run/progress/two side-by-side grids,
  nominal cell outlined, job in tooltip) on both pages. tsc clean, 34/34.
- Portability §7: `scripts/build_model.sh`, `scripts/self_check.sh`,
  NGSPICE_BIN/OSDI_PATH env, `AGENTS.md`, `private/` gitignore rule, fresh
  `dist/` with `base: "/circuit-muse/"` verified.

## 2026-10-29 00:25 KST — independent re-verification (operator)
- vitest 34/34 PASS (fresh `npx vitest run`).
- backend pytest: first run showed 18/21 (3 `test_http` JSONDecodeError).
  Root cause was NOT repo code: the verify shell exported `http_proxy*`,
  so urllib sent loopback 127.0.0.1:8769 traffic to a sandbox proxy, which
  answered `upstream connection failed: Connection refused (os error 111)`.
  Re-ran with proxy vars unset → **21/21 PASS** (19s). No code change.
  Note for Codex setup: run tests with `no_proxy` covering localhost or
  with `*_proxy` unset, otherwise `test_http` fails the same way.

## 2026-10-29 00:40 KST — operator 5-item audit (independent)
1. Deck rerun (/tmp/verify_rerun.py): 13 saved job.cir (GW/EM/GC/GI nom,
   EM start 2/4/8H, pixel DATA 2/3/4V, EM-deg FAIL, EM-deg VGL-11 PASS,
   max-uniform FAIL) re-ran in /tmp/rerun3 — all BIT-IDENTICAL (max|dV|=0),
   pass/fail + widths + currents match every claim.
2. EM vs US11205374B2 (Google Patents full text): 12/12 TFT + 3/3 caps +
   stage-2 clock swap + 4H start -> 3H output + PMOS/low gate-on all match
   Fig.4 description. S/D orientation is our assumption (patent says only
   "connected between"), disclosed in CIRCUITS.md.
3. Schematic vs netlist: frontend VC/EM12/GW_WL/caps/pixel constants ==
   backend presets.py 1:1 (GW 9/9, EM 12/12+W/L, caps 5/5, pixel 8/8);
   SchemEditor renders from live tft data, no hardcoded nets.
4. scripts/self_check.sh fresh: SELF-CHECK OK (backend 21/21, vitest 34/34,
   vite build ok). Script already strips *proxy (known env quirk).
5. Pixel T1 dVth -0.2/0/+0.2V recomputed from saved out.txt: 1.7025/1.6998/
   1.6964 uA (spread 0.36%) — matches SELF_CHECK.txt. Speed measured:
   driver 0.5-1.1s/sim, pixel 0.2s/sim (OMP_THREAD_LIMIT=1).

## 2026-10-29 — /circuit2/ deploy prep (operator order)
- Frontend now tries same-origin `<page-dir>/api/*` first, falls back to
  127.0.0.1:8768 (api.ts; post()/getMargin() loop all BACKENDS like
  tryBackend). +2 vitest (36/36), tsc clean, SELF-CHECK OK.
- Built /tmp/c2root/circuit2 with --base=/circuit2/; local smoke: page 200,
  asset 200, backend /health ok. Committed dist/ stays /circuit-muse/.
- Runbook: docs/DEPLOY_CIRCUIT2.md (static copy, backend A/B, nginx block,
  sudo reload). Remote steps (scp, nginx, reload) need the user: sandbox
  has no tailnet/SSH route to the old laptop.
