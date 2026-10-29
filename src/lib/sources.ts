// Source trace: which patent sentence each EM connection comes from.
// Samsung Display US 11,205,374 B2, Fig.4 first embodiment.
// Sentences are condensed paraphrases of the Google Patents text;
// the full table lives in docs/CIRCUITS.md.
// Mapping: patent 101->IN (FLM at stage 1), 102->CKA, 103->CKB,
// VDD->VGH, VSS->VGL, M1..M12->T1..T12.

export interface TraceRow {
  id: string;      // T1..T12, C1..C3
  patent: string;  // M1..M12, C1..C3
  conn: string;    // G/S/D or a-b as built
  sentence: string;
}

export const EM_PATENT = "Samsung Display US 11,205,374 B2, Fig.4 (first embodiment)";

export const EM_TRACE: TraceRow[] = [
  { id: "T6", patent: "M6", conn: "G=CLK1 S=FLM D=N1",
    sentence: "M6 connected between the first input terminal 101 and N1; gate to the second input terminal 102." },
  { id: "T7", patent: "M7", conn: "G=N1 S=N2 D=CLK1",
    sentence: "M7 connected between N2 and 102; gate to N1." },
  { id: "T8", patent: "M8", conn: "G=CLK1 S=N2 D=VGL",
    sentence: "M8 connected between N2 and VSS; gate to 102; supplies VSS to N2." },
  { id: "T1", patent: "M1", conn: "G=N2 S=VGH D=N7",
    sentence: "M1 in series with M2 between VDD and N3; gate to N2; connects VDD to M2." },
  { id: "T2", patent: "M2", conn: "G=CLK2 S=N7 D=N3",
    sentence: "M2 in series with M1; gate to 103; one electrode directly connected to N3." },
  { id: "T3", patent: "M3", conn: "G=VGL S=N1 D=N3",
    sentence: "M3 connected between N1 and N3; gate to VSS; always-on transistor (AOT)." },
  { id: "T9", patent: "M9", conn: "G=VGL S=N2 D=N5",
    sentence: "M9 connected between N2 and N5; gate to VSS; always-on (AOT)." },
  { id: "T10", patent: "M10", conn: "G=CLK2 S=N6 D=N4",
    sentence: "M10 connected between N6 and N4; gate to 103." },
  { id: "T11", patent: "M11", conn: "G=N5 S=N6 D=CLK2",
    sentence: "M11 connected between N6 and 103; gate to N5." },
  { id: "T12", patent: "M12", conn: "G=N1 S=VGH D=N4",
    sentence: "M12 connected between VDD and N4; gate to N1 (first embodiment; Fig.8 variant uses N3)." },
  { id: "T4", patent: "M4", conn: "G=N4 S=VGH D=OUT",
    sentence: "M4 connected between VDD and the output terminal 104; gate to N4." },
  { id: "T5", patent: "M5", conn: "G=N3 S=OUT D=VGL",
    sentence: "M5 connected between 104 and VSS; gate to N3; sets emission state." },
  { id: "C1", patent: "C1", conn: "N3-CLK2",
    sentence: "C1 connected between N3 and 103; controls N3 in response to CLK2." },
  { id: "C2", patent: "C2", conn: "N5-N6",
    sentence: "C2 connected between N5 and N6." },
  { id: "C3", patent: "C3", conn: "VGH-N4",
    sentence: "C3 connected between VDD and N4; keeps N4 stable." },
];

export const EM_TRACE_NOTES: string[] = [
  "Odd stages: CKA=CLK1, CKB=CLK2; even stages swapped (ST2 receives CLK2/CLK1 on 102/103).",
  "Behavior: 4H start pulse -> 3H outputs shifting 1H per stage (measured 2H->1.01H, 4H->3.01H, 8H->7.01H).",
  "N7 (M1-M2 junction) has no patent name; any internal name works.",
  "S/D orientation chosen by the higher-potential rule (patent says only \u201cconnected between\u201d); model treated as near-symmetric.",
  "All W/L, capacitances, and timings are synthetic assumptions, not from the patent.",
];

export const EM_REUSE_NOTE =
  "GC/GI reuse the EM 12T3C stage with a narrower start pulse (assumption, no separate published GC/GI stage).";
