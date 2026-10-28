"""Self-check: degraded FAIL at nominal rails, PASS after VGH/VGL change.

Mechanism (from node waveforms): T3/T9 are the always-on (G=VGL)
precharge TFTs of the EM stage. Crippled (dVth=1.5V, ion=0.15), they
cannot pull N3/N5 to their levels at VGL=-9.5V, so the output never
reaches VGH-margin. Deeper VGL restores their overdrive and the stage
passes again.
"""
import copy
import unittest
import aging
import backend
from presets import EM_TFT


class TestStress(unittest.TestCase):
    def test_driver_table(self):
        r = aging.run_stress({
            "desc": {"kind": "driver", "preset": "EM", "VGH": 8.0,
                     "VGL": -9.5, "freq_kHz": 250, "stages": 2,
                     "frames": 1},
            "temp_C": 85, "hours": 500})
        self.assertTrue(r.get("ok"), r.get("errors"))
        self.assertEqual(len(r["table"]), 12)
        t12 = [x for x in r["table"] if x["tft"] == "T12"][0]
        self.assertGreater(t12["dVth"], 0)
        print("driver stress T12:", t12, "job=", r["job"])

    def test_pixel_table(self):
        r = aging.run_stress({"desc": {"kind": "pixel", "DATA": 3.0},
                              "temp_C": 85, "hours": 500})
        self.assertTrue(r.get("ok"), r.get("errors"))
        self.assertEqual(len(r["table"]), 8)
        t5 = [x for x in r["table"] if x["tft"] == "T5"][0]
        # emission TFT is on ~98% of the frame -> largest dVth
        self.assertGreater(t5["duty_on"], 0.9)
        self.assertGreater(t5["dVth"], 0)
        print("pixel stress T5:", t5, "job=", r["job"])


def _crippled():
    t = copy.deepcopy(EM_TFT)
    for k in ("T3", "T9"):
        t[k].update(dVth=1.5, ion=0.15)
    return t


class TestDegradedMargin(unittest.TestCase):
    def test_fail_nominal_pass_deeper_vgl(self):
        t = _crippled()
        base = {"kind": "driver", "preset": "EM", "VGH": 8.0,
                "freq_kHz": 250, "stages": 4, "frames": 2, "tft": t}
        r_fail = backend.run_job(dict(base, VGL=-9.5))
        self.assertTrue(r_fail.get("ok"), r_fail.get("errors"))
        self.assertFalse(r_fail["passfail"]["pass"],
                         "crippled T3/T9 must FAIL at nominal rails")
        print("nominal FAIL job=", r_fail["job"],
              r_fail["passfail"]["reasons"][:1])
        r_fix = backend.run_job(dict(base, VGL=-11.0))
        self.assertTrue(r_fix.get("ok"), r_fix.get("errors"))
        self.assertTrue(r_fix["passfail"]["pass"],
                        f"deeper VGL must fix it: "
                        f"{r_fix['passfail']['reasons'][:2]}")
        print("VGL=-11 PASS job=", r_fix["job"])

    def test_unfixable(self):
        # max-uniform degradation: no rail corner in range restores switching
        t = copy.deepcopy(EM_TFT)
        for p in t.values():
            p.update(dVth=2.0, ion=0.1, ioff=100.0, ss=3.0)
        for vgh, vgl in ((8.0, -9.5), (12.0, -14.0)):
            r = backend.run_job({"kind": "driver", "preset": "EM",
                                 "VGH": vgh, "VGL": vgl, "freq_kHz": 250,
                                 "stages": 4, "frames": 2, "tft": t})
            self.assertTrue(r.get("ok"), r.get("errors"))
            self.assertFalse(r["passfail"]["pass"],
                             f"max-uniform must FAIL at {(vgh, vgl)}")
            print(f"max-uniform {(vgh, vgl)} FAIL job=", r["job"],
                  r["passfail"]["reasons"][:1])


if __name__ == "__main__":
    unittest.main(verbosity=2)
