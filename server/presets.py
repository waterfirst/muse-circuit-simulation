"""Presets for gw-react display-circuit simulator.

Sources (public only):
- GW 9T: carried over from gw_lab (validated vC topology).
- EM 12T3C: Samsung Display US 11,205,374 B2, Fig.4 first embodiment.
  Patent nodes M1..M12 map to T1..T12 here; VDD->VGH, VSS->VGL,
  2nd input->CKA, 3rd input->CKB, 1st input->IN (FLM at stage 1).
  See docs/CIRCUITS.md for the per-connection patent sentences.
- GC/GI: ASSUMPTION - reuse the EM 12T3C stage with a narrow start pulse
  (positive high pulse suitable for n-type oxide TFT gates). No separate
  public GC/GI stage was implemented; reviewer should check this choice.
- Pixel 8T1C: generic LTPO topology from public literature
  (US 11,056,060 B2 / US 11,600,229 B2 family: T1 drive P, T2 write P,
  T3 comp N, T4 gate-init N, T5/T6 emission P, T7 anode-init P,
  T8 on-bias P). All sizes/caps synthetic assumptions.

All W/L and capacitances are SYNTHETIC ASSUMPTIONS (not from any
company netlist or measured data) and are labeled so in the UI.
"""
from __future__ import annotations

# ---------------- GW (vC 9T, low_pulse) ----------------
GW_TFT = {
    "T1": {"G": "CLK1", "S": "FLM", "D": "B",   "W": 8,  "L": 4.5},
    "T2": {"G": "C",    "S": "VGH", "D": "A",   "W": 4,  "L": 6},
    "T3": {"G": "CLK2", "S": "A",   "D": "B",   "W": 4,  "L": 4.5},
    "T4": {"G": "B",    "S": "VGH", "D": "C",   "W": 4,  "L": 4.5},
    "T5": {"G": "CLK1", "S": "QB",  "D": "VGL", "W": 4,  "L": 6},
    "T6": {"G": "QB",   "S": "VGH", "D": "OUT", "W": 40, "L": 4.5},
    "T7": {"G": "Q",    "S": "OUT", "D": "CLK2","W": 4,  "L": 4.5},
    "T8": {"G": "VGL",  "S": "B",   "D": "Q",   "W": 4,  "L": 4.5},
    "T9": {"G": "CLK2", "S": "QB",  "D": "C",   "W": 4,  "L": 4.5},
}
GW_CAPS = [
    {"a": "VGH", "b": "QB", "pf": 1.0, "name": "C1"},
    {"a": "OUT", "b": "Q",  "pf": 0.2, "name": "C2"},
]

# ---------------- GW10T2C (muse 10T2C, T10 NMOS, low_pulse) ----------------
GW10T2C_TFT = {
    "T1": {"G": "CLK1", "S": "FLM", "D": "Q2",  "W": 6,   "L": 4},
    "T2": {"G": "QB",   "S": "VGH", "D": "A",   "W": 6,   "L": 4},
    "T3": {"G": "CLK2", "S": "A",   "D": "Q2",  "W": 6,   "L": 4},
    "T4": {"G": "Q2",   "S": "CLK1","D": "QB",  "W": 60,  "L": 4},
    "T5": {"G": "CLK1", "S": "QB",  "D": "Q",   "W": 12,  "L": 4},
    "T6": {"G": "QB",   "S": "VGH", "D": "B",   "W": 6,   "L": 4},
    "T7": {"G": "Q",    "S": "CLK2","D": "B",   "W": 100, "L": 4},
    "T8": {"G": "VGL",  "S": "Q2",  "D": "Q",   "W": 12,  "L": 4},
    "T9": {"G": "B",    "S": "VGH", "D": "OUT", "W": 200, "L": 4},
    "T10": {"G": "B",   "S": "OUT", "D": "VGL", "W": 200, "L": 4, "type": "N"},
}
GW10T2C_CAPS = [
    {"a": "VGH", "b": "QB", "pf": 1.0, "name": "C1"},
    {"a": "Q",   "b": "B",  "pf": 2.0, "name": "C2"},
]

# ---------------- EM (US11205374B2 Fig.4, high_pulse) ----------------
# Patent M1..M12 -> T1..T12. N7 = unnamed M1-M2 series junction (assumption).
EM_TFT = {
    "T1":  {"G": "N2",  "S": "VGH", "D": "N7",  "W": 8,  "L": 4.5},  # M1 VDD->M2
    "T2":  {"G": "CLK2","S": "N7",  "D": "N3",  "W": 8,  "L": 4.5},  # M2 ->N3 direct
    "T3":  {"G": "VGL", "S": "N1",  "D": "N3",  "W": 4,  "L": 4.5},  # M3 AOT N1-N3
    "T4":  {"G": "N4",  "S": "VGH", "D": "OUT", "W": 40, "L": 4.5},  # M4 out pull-up
    "T5":  {"G": "N3",  "S": "OUT", "D": "VGL", "W": 20, "L": 4.5},  # M5 out pull-down
    "T6":  {"G": "CLK1","S": "FLM", "D": "N1",  "W": 8,  "L": 4.5},  # M6 IN->N1
    "T7":  {"G": "N1",  "S": "N2",  "D": "CLK1","W": 4,  "L": 4.5},  # M7 N2-CKA
    "T8":  {"G": "CLK1","S": "N2",  "D": "VGL", "W": 4,  "L": 4.5},  # M8 N2-VSS
    "T9":  {"G": "VGL", "S": "N2",  "D": "N5",  "W": 4,  "L": 4.5},  # M9 AOT N2-N5
    "T10": {"G": "CLK2","S": "N6",  "D": "N4",  "W": 4,  "L": 4.5},  # M10 N6-N4
    "T11": {"G": "N5",  "S": "N6",  "D": "CLK2","W": 4,  "L": 4.5},  # M11 N6-CKB
    "T12": {"G": "N1",  "S": "VGH", "D": "N4",  "W": 8,  "L": 4.5},  # M12 VDD->N4
}
EM_CAPS = [
    {"a": "N3",  "b": "CLK2", "pf": 0.3, "name": "C1"},
    {"a": "N5",  "b": "N6",   "pf": 0.3, "name": "C2"},
    {"a": "VGH", "b": "N4",   "pf": 1.0, "name": "C3"},
]

# GC / GI: assumption - same stage as EM, narrower start pulse.
GC_TFT = {k: dict(v) for k, v in EM_TFT.items()}
GC_CAPS = [dict(c) for c in EM_CAPS]
GI_TFT = {k: dict(v) for k, v in EM_TFT.items()}
GI_CAPS = [dict(c) for c in EM_CAPS]

DRIVER_DEFAULTS = {
    "GW": {"polarity": "low_pulse",  "start_width_H": 1, "tft": GW_TFT, "caps": GW_CAPS},
    "GW10T2C": {"polarity": "low_pulse", "start_width_H": 1, "tft": GW10T2C_TFT, "caps": GW10T2C_CAPS},
    "EM": {"polarity": "high_pulse", "start_width_H": 4, "tft": EM_TFT, "caps": EM_CAPS},
    "GC": {"polarity": "high_pulse", "start_width_H": 2, "tft": GC_TFT, "caps": GC_CAPS},
    "GI": {"polarity": "high_pulse", "start_width_H": 2, "tft": GI_TFT, "caps": GI_CAPS},
}

# ---------------- 8T1C LTPO pixel (synthetic) ----------------
# Nodes: NG (T1 gate/Cst), NS (T1 source/write), ND (T1 drain),
# ANODE. Controls: GI/GC active-HIGH (N TFTs), GW/EM/GO active-LOW (P).
PIXEL_TFT = {
    "T1": {"type": "P", "G": "NG",   "S": "NS",    "D": "ND",    "W": 3, "L": 6, "dVth": 0.0},
    "T2": {"type": "P", "G": "GW",   "S": "DATA",  "D": "NS",    "W": 3, "L": 4.5, "dVth": 0.0},
    "T3": {"type": "N", "G": "GC",   "S": "NG",    "D": "ND",    "W": 3, "L": 4.5, "dVth": 0.0},
    "T4": {"type": "N", "G": "GI",   "S": "VINT",  "D": "NG",    "W": 3, "L": 4.5, "dVth": 0.0},
    "T5": {"type": "P", "G": "EM",   "S": "ELVDD", "D": "NS",    "W": 6, "L": 4.5, "dVth": 0.0},
    "T6": {"type": "P", "G": "EM",   "S": "ND",    "D": "ANODE", "W": 6, "L": 4.5, "dVth": 0.0},
    "T7": {"type": "P", "G": "GW",   "S": "VINT",  "D": "ANODE", "W": 3, "L": 4.5, "dVth": 0.0},
    "T8": {"type": "P", "G": "GO",   "S": "VOBS",  "D": "NS",    "W": 3, "L": 4.5, "dVth": 0.0},
}
PIXEL_DEFAULTS = {
    "ELVDD": 4.6, "ELVSS": 0.0, "VINT": -2.0, "VOBS": 5.0, "DATA": 3.0,
    "VGH": 8.0, "VGL": -9.5, "frame_hz": 120.0,
    "Cst_pf": 0.2, "Coled_pf": 1.0, "VT0_P": 1.1, "VT0_N": 1.1,
    # active windows [start,end] us inside one frame (frame=8333us @120Hz)
    "timing": {"GI": [0, 30], "GO": [40, 70], "GW": [80, 110],
               "GC": [80, 110], "EM": [150, 8300]},
}
