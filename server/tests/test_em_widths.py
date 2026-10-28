"""Self-check: EM at start widths 2H/4H/8H - one pulse per stage, width vs start."""
import unittest
import backend


class TestEMWidths(unittest.TestCase):
    def test_widths(self):
        for w in (2, 4, 8):
            r = backend.run_job({"kind": "driver", "preset": "EM", "VGH": 8.0,
                                 "VGL": -9.5, "freq_kHz": 250, "stages": 4,
                                 "frames": 2, "start_width_H": w})
            self.assertTrue(r.get("ok"), f"W={w}: {r.get('errors')}")
            pf = r["passfail"]
            for k, s in pf["stages"].items():
                self.assertEqual(s["pulses"], 1, f"W={w} {k}: {s}")
            f1 = {k: v for k, v in pf["stages"].items() if k.startswith("f1")}
            widths = [v.get("width_H") for v in f1.values()]
            print(f"start {w}H -> measured {widths} job={r['job']} pass={pf['pass']}")
            self.assertTrue(pf["pass"], f"W={w}: {pf['reasons'][:3]}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
