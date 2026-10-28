"""Self-check: pixel DATA=2/3/4 monotonic + T1 dVth +-0.2V check runs."""
import copy
import unittest
import backend
from presets import PIXEL_TFT


class TestPixel(unittest.TestCase):
    def test_monotonic(self):
        cur = []
        for d in (2.0, 3.0, 4.0):
            r = backend.run_pixel({"kind": "pixel", "DATA": d})
            self.assertTrue(r.get("ok"), f"DATA={d}: {r.get('errors')}")
            i = r["result"]["i_emission_uA"]
            cur.append(i)
            print(f"DATA={d}V: I={i}uA NG={r['result']['ng_after_gc_V']}V job={r['job']}")
        self.assertGreater(cur[0], cur[1], "I(2V) > I(3V)")
        self.assertGreater(cur[1], cur[2], "I(3V) > I(4V)")

    def test_dvth(self):
        cur = {}
        for dv in (-0.2, 0.0, 0.2):
            t = copy.deepcopy(PIXEL_TFT)
            t["T1"]["dVth"] = dv
            r = backend.run_pixel({"kind": "pixel", "DATA": 3.0, "tft": t})
            self.assertTrue(r.get("ok"), f"dVth={dv}: {r.get('errors')}")
            cur[dv] = r["result"]["i_emission_uA"]
            print(f"dVth={dv:+}: I={cur[dv]}uA job={r['job']}")
        spread = (max(cur.values()) - min(cur.values())) / cur[0.0]
        print(f"compensation spread: {spread*100:.2f}%")
        self.assertLess(spread, 0.10, "Vth compensation should hold current within 10%")


if __name__ == "__main__":
    unittest.main(verbosity=2)
