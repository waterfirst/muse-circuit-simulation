# Circuits — sources and assumptions

All W/L, capacitances, and timings are SYNTHETIC ASSUMPTIONS (not from any
company netlist or measured data). Only public patents/literature were used.

## EM 12T3C — Samsung Display US 11,205,374 B2, Fig.4 first embodiment

Mapping: patent M1..M12 → T1..T12, VDD → VGH, VSS → VGL,
1st input → IN (FLM at stage 1), 2nd input → CKA, 3rd input → CKB.
Odd stages: CKA=CLK1, CKB=CLK2; even stages swapped (patent: stage 2 receives
CLK2/CLK1 through 2nd/3rd inputs).

| This work | Patent sentence (paraphrased from Google Patents text) |
|---|---|
| T6 S=IN D=N1 G=CKA | "the sixth transistor M6 is connected between the first input terminal 101 and the first node N1 ... gate ... connected to the second input terminal 102" |
| T7 S=N2 D=CKA G=N1 | "the seventh transistor M7 is connected between the second node N2 and the second input terminal 102 ... gate ... connected to the first node N1" |
| T8 S=N2 D=VGL G=CKA | "the eighth transistor M8 is connected between the second node N2 and the second power supply VSS ... gate ... connected to the second input terminal 102" |
| T1 S=VGH D=N7 G=N2 | "the first and second transistors M1 and M2 may be connected in series between the first power supply VDD and the third node N3" + "gate of M1 connected to the second node N2". N7 = unnamed M1–M2 junction (assumption) |
| T2 S=N7 D=N3 G=CKB | M1–M2 series as above + "gate of M2 connected to the third input terminal 103" + "one electrode of M2 directly connected to the third node N3" |
| T3 S=N1 D=N3 G=VGL | "M3 connected between the first node N1 and the third node N3 ... gate connected to the second power supply VSS ... always on transistor" |
| T9 S=N2 D=N5 G=VGL | "M9 connected between the second and fifth nodes N2 and N5 ... gate connected to VSS ... always on" |
| T10 S=N6 D=N4 G=CKB | "M10 connected between the sixth node N6 and the fourth node N4 ... gate connected to the third input terminal 103" |
| T11 S=N6 D=CKB G=N5 | "M11 connected between the sixth node N6 and the third input terminal 103 ... gate connected to the fifth node N5" |
| T12 S=VGH D=N4 G=N1 | "M12 connected between the first power supply VDD and the fourth node N4 ... gate connected to the first node N1" (first embodiment; Fig.8 variant uses N3) |
| T4 S=VGH D=OUT G=N4 | "M4 connected between the first power supply VDD and the output terminal 104 ... gate connected to the fourth node N4" |
| T5 S=OUT D=VGL G=N3 | "M5 connected between the output terminal 104 and the second power supply VSS ... gate connected to the third node N3" |
| C1 N3–CKB | "the first capacitor C1 is connected between the third node N3 and the third input terminal 103" |
| C2 N5–N6 | "the second capacitor C2 is connected between the fifth node N5 and the sixth node N6" |
| C3 VGH–N4 | "the third capacitor C3 is connected between the first power supply VDD and the fourth node N4" |

Behavior check vs patent: start pulse rests low, pulses high (≈4H in the
patent); outputs rest low (emission) and pulse high with ~start−1H width,
shifting 1H per stage (patent: 4H start → 3H outputs). Measured: 2H→1.01H,
4H→3.01H, 8H→7.01H (see SELF_CHECK.txt). Width tolerance ±1.5H.

## GC / GI — ASSUMPTION, reviewer check requested

GC and GI reuse the EM 12T3C stage with start_width_H=2 (positive high pulse
suitable for n-type oxide TFT gates). No separate public GC/GI stage was
implemented. Both pass the same checks as EM under defaults.

## GW 9T — carried over (vC topology from gw_lab)

Unchanged connections; now with W/L + caps as inputs, clock_mode, and
per-stage pass/fail. Default clock_mode=continuous passes.

## 8T1C LTPO pixel — public-literature topology (US 11,056,060 B2 /
US 11,600,229 B2 family)

T1 drive P (NS→ND, G=NG); T2 write P (DATA→NS, G=GW); T3 comp N (NG–ND,
G=GC, diode-connects T1); T4 gate-init N (VINT→NG, G=GI); T5 emission P
(ELVDD→NS, G=EM); T6 emission P (ND→ANODE, G=EM); T7 anode-init P
(VINT→ANODE, G=GW); T8 on-bias P (VOBS→NS, G=GO). Cst NG–ELVDD,
C_OLED ANODE–ELVSS. OLED = synthetic diode (IS=1e-15, N=1.2, RS=300k) +
0V sense source; current +i(Vsense). All values synthetic assumptions.

## Key assumptions for the reviewer

1. EM S/D orientation of pass TFTs (T3/T9/T10/T11) chosen by the higher-potential rule; model treated as near-symmetric.
2. N7 (M1–M2 junction) has no patent name; any internal name works.
3. GC/GI = EM stage reuse (not a separate published GC/GI circuit).
4. ptft_fit POL=-1 used for oxide TFTs after one-device probe (server/runs/probe_pol/).
5. OLED diode card is synthetic; absolute current values are illustrative.
