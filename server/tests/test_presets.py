"""Self-check: every preset runs and returns pass/fail with reasons."""
import unittest
import backend


class TestPresets(unittest.TestCase):
    def _run(self, preset):
        r = backend.run_job({"kind": "driver", "preset": preset, "VGH": 8.0,
                             "VGL": -9.5, "freq_kHz": 250, "stages": 4,
                             "frames": 2})
        self.assertTrue(r.get("ok"), f"{preset}: {r.get('errors')}")
        pf = r.get("passfail")
        self.assertIsNotNone(pf, f"{preset}: no passfail")
        self.assertIn("pass", pf)
        self.assertTrue(pf["reasons"], f"{preset}: no reasons")
        print(f"{preset}: pass={pf['pass']} job={r['job']} reasons={pf['reasons'][:2]}")
        return r

    def test_gw(self):
        self._run("GW")

    def test_em(self):
        self._run("EM")

    def test_gc(self):
        self._run("GC")

    def test_gi(self):
        self._run("GI")


if __name__ == "__main__":
    unittest.main(verbosity=2)
