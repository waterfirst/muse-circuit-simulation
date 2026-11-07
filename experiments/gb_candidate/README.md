# GB 16T3C research controls

Fixed, small reproduction inputs for 16 six-stage fresh-model experiments. These are numerical research controls, **not a measured panel diagnosis, production design, or verified physical PDK**. The app's original synthetic candidate preset is unchanged by the later gate experiments.

## Reproduce

Prerequisites: Python 3.10+, NumPy, an OSDI-enabled ngspice (recorded runs used libngspice 44.2), and an OpenVAF compiler capable of building this repository's `models/ptft_fit.va`. Build that source locally using a trusted compiler, e.g. `openvaf models/ptft_fit.va -o /tmp/ptft_fit.osdi` from the repository root. No model/compiler binary is included here. Follow your installed OpenVAF version's include-path options if needed.

From this folder:

    python -m pip install numpy
    python run.py candidate_W112_C1 --osdi /tmp/ptft_fit.osdi --output results

Select any case listed in `manifest.json`. Each case has a portable fixed `deck.cir` and recorded metrics. The runner copies the model to a new result folder, invokes `ngspice -b`, validates finite output through 400 us, and measures both input events. Existing output folders are never overwritten. `--prepare-only` validates/copies inputs without simulation. A local CLI must support `pre_osdi`; the original runs used the shared library, so CLI numerical results may differ slightly. The portable runner was syntax-checked and preparation-tested; expensive simulations were not repeated just to package it. Recorded metrics come from the earlier completed runs, not this wrapper.

Only the `pre_osdi` path was normalized from each executed deck. No waveforms, private machine paths, executables, authentication data, or generated OSDI binaries are included. `manifest.json` hashes the portable decks. Large raw outputs remain excluded via `.gitignore`.

## Cases and scope

- `candidate_W56_C03`, `candidate_W112_C03`, `candidate_W56_C1`, `candidate_W112_C1`: synthetic candidate T9 width 56/112 um × C3 0.3/1 pF. **C3 is N2–OUT**, not the original N4–N3. All six stages use each setting. C3=0.3 fails propagation (repeated/missing pulses); C3=1 and W56 has hold minimum about6.997 V (just below the7 V comparator), while W112 has about7.116 V and passes both input events under these comparison criteria.
- `A_candidate_DS`, `A_candidate_DS_L6`: candidate with T14 gate restored to N3 and T15 gate restored to CKB, T15 D/S=N8/VGL. T15 L=4.5/6 um. Both fail with repeated pulses.
- `B_original_DS`, `B_original_DS_L6`: same gate controls, but T15 D/S=N4/IN. Both pass the tested events; first-event minimum fixed-window hold about7.086/7.079 V. **T14 source remains N8**, T10 source remains CKA, T9 W remains112, C3 remains N2–OUT1 pF. These are not the original full circuit.
- `original_topology_W56_native_phase`, `original_topology_W112_native_phase`, `original_topology_W56_swapped`, `original_topology_W112_swapped`: all original TFT connections/W/L except explicit T9 width control; original C3=N4–N3,0.3 pF. Neither width achieves six-stage propagation. Native first phase has no midpoint pulses. Swapped W56 has midpoint pulses in stages1–2 only; swapped W112 in1–3 only. Midpoint crossing is not sufficient to meet the -6 V Low target.
- `original_C03_native_phase`, `original_C1_native_phase`, `original_C03_swapped`, `original_C1_swapped`: original TFT connections/W/L throughout (T9 W56, T15 L6), C3 stays N4–N3, only capacitance0.3/1 pF differs within each phase. C03 cases reuse previous original W56 runs. Native phase: neither capacitance produces a pulse. Swapped phase: output minima for0.3 pF are[-5.703,-3.003,-0.367,2.176,4.632,7.142] V; for1 pF[-5.709,-3.009,-0.374,2.170,4.626,7.131] V. No six-stage recovery.

## Fixed assumptions and aliases

The supplied original circuit did not specify model, numeric supplies, timing, or external load. These experiments add a synthetic fresh `ptft_fit` model (VT0=2.305752757586326, U0=65, SS=0.3, GOFF=1e-14, POL=1), +8/-9 V rails, and external C4 OUT–0=5 pF. VT0 was calibrated for a reference W/L=4/4.5 device at a particular constant-current extraction criterion; it is not proof of every geometry's threshold. C1=C2=0.1 pF. The repository backend default VGL may be -9.5 V; these explicit experiment decks use -9 V.

D/G/S ordering is used. FLM→IN, CLK1→CKA, CLK2→CKB are local port aliases. Native first phase connects odd stages CKA=externalCLK1, CKB=externalCLK2, even stages oppositely. Swapped phase reverses those assignments; the synthetic candidate uses swapped phase. Thus restoring T15 gate to local CKB does not mean external CLK2 on every stage.

CLK1/CLK2 periods8 us, delays8/4 us, rise/fall0.05 us, pulse parameter2.95 us. FLM inputs at160 and280 us. ESR rises from-9 to+8 V at80–80.05 us. Every deck records exact settings, device geometry, node connectivity, and Gear tolerances. No artificial fixture resistors are used.

## Metrics and limitations

Evaluate150–220 us and270–340 us; complete pulses cross -0.5 V. Comparison targets: exactly one pulse, minimum≤-6 V, inactive minimum≥+7 V, starts in increasing stage order; strict timing adds4±0.2 us stage spacing and3±0.2 us width. These are research comparison targets, not supplied original circuit specifications.

`rest_min_v` excludes±4 us around detected active pulses. `expected_hold_min_v` instead excludes the fixed interval[160+4i,171+4i] us for stage index i=0…5 (shifted120 us for event2). The fixed window was chosen for candidate timing, not independently validated as the original circuit's active interval. Multiple-pulse cases can make the detected-pulse rest metric unavailable. Read the complete waveform and pulse counts, not a lone margin or pass flag. No aging, PVT sweep, full extracted parasitics, or real-panel failure attribution is established here.
