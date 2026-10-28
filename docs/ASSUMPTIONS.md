# ASSUMPTIONS — synthetic values (no company data anywhere)

Every number below is a synthetic assumption chosen by the author from public
patents/literature only. A reviewer should check each of them first.

## Devices and sizes

- Model: `ptft_fit` Verilog-A (`models/ptft_fit.va`, copied from public study
  material under `~/tft_sim_study/`), compiled locally with OpenVAF
  (`scripts/build_model.sh`). `POL=1` = p-type LTPS, `POL=-1` = n-type oxide,
  each verified with a one-device I–V deck (`server/runs/probe_p/`,
  `server/runs/probe_n/`): P off at Vg≈Vs with Id≈5e-14A, conducting for
  Vsg>~1.1V; N off below Vg≈1V, conducting above.
- The model has NO temperature term (`vt = $vt(300.15)` fixed); temperature is
  applied externally in `backend.eff_params` (below). Model `TSTRESS` aging
  terms are left at 0; aging is done externally via per-TFT degradation inputs.
- Deck mobility default `U0=65` cm²/Vs (carried from gw_lab; the `.va` default
  is 80). `SS=0.30` V/dec, `GOFF=1e-14` S, `VT0=1.1` V fresh unless edited.
- All TFT W/L, capacitances, OLED diode card (`IS=1e-15, N=1.2, RS=300k`),
  `Cst`/`C_OLED`, timings and rails are synthetic, not measured.

## Circuits

- EM 12T3C: connections from Samsung Display US 11,205,374 B2 text
  (see `docs/CIRCUITS.md`); S/D orientation of pass TFTs, the unnamed M1–M2
  junction `N7`, and all sizes are assumptions.
- GC/GI reuse the EM stage with a 2H start pulse (assumption, not a separate
  published GC/GI circuit).
- 8T1C pixel: generic LTPO topology from the US 11,056,060 B2 /
  US 11,600,229 B2 family; default `ELVDD=4.6V` (not a phone rail) chosen so
  T1 stays in saturation with the synthetic OLED card.

## Temperature mapping (`backend.eff_params`)

- `VT0(T) = VT0 + dVth − 0.004·(T−25)` (|Vth| falls 4mV/°C, P and N same).
- `U0(T) = 65·ion·(1+tc·(T−25))`, `tc=−0.002` (P) / `+0.001` (N) per °C.
- `GOFF(T) = 1e-14·ioff·10^((T−25)/60)`: ×10 per 60°C, i.e. ×10 from 25°C to
  85°C per the operator's LTPS calibration hint.
- `SS(T) = 0.30·ss·(T+273.15)/298.15` (ideal linear-with-T slope).

## Degradation inputs and BTS stress law (`server/aging.py`)

- Per-TFT: `dVth` (−2..+2V, added to |Vth|), `ion` (×U0, 0.1..2),
  `ioff` (×GOFF, 0.1..100), `ss` (×SS, 0.5..3).
- Stress law form (public-literature tradition: power-law ΔVth∝t^n with
  Arrhenius acceleration, Powell-1989 a-Si:H family; coefficients synthetic):
  `dVth = A_pol·t_h^N_T·exp(Ea/k·(1/Tref−1/T))·bias`,
  `bias = duty_on·(Von/V0)^G_ON + (1−duty_on)·(|Voff|/V0off)^G_OFF`,
  defaults `A_P=0.005, A_N=0.003, N_T=0.35, Ea=0.35eV, V0=5V, V0off=10V,
  G_ON=1.5, G_OFF=1.0`; `ion=1/(1+0.1·dVth)`, `ioff=1+0.5·dVth`,
  `ss=1+0.05·dVth`. dVth≥0 always (|Vth| growth for both polarities).
- Stress is measured from a FRESH-device run at 25°C (law evaluated at the
  stress temperature), time-weighted (trapezoid) over non-uniform steps.
- Driver window = all simulated frames: each simulated frame already contains
  scan+hold (frame = K whole clock periods by construction), so measured duty
  cycles directly represent real-frame-rate operation — no extra weighting.
  Pixel window = frame 2. Terminal voltages use declared S/D pins (no S/D
  swap tracking — documented limitation).
- Margin map pixel % = vs fresh-device current at nominal rails; driver =
  pass/fail per cell. Grid ≤49 cells ×2 variants, sequential background job.
