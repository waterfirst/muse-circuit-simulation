"""Self-check: bad input rejected before any netlist is written."""
import os
import unittest
import backend


def _job_count():
    return len([d for d in os.listdir(backend.RUNS)
                if os.path.isdir(os.path.join(backend.RUNS, d))])


class TestValidation(unittest.TestCase):
    def test_unknown_node(self):
        n0 = _job_count()
        r = backend.run_job({"kind": "driver", "preset": "GW", "tft": {
            "T1": {"G": "CLK1", "S": "FLM", "D": "NOPE"}}})
        self.assertFalse(r.get("ok"))
        self.assertTrue(any("NOPE" in e for e in r["errors"]))
        self.assertEqual(_job_count(), n0, "no job dir may be created")

    def test_out_of_range(self):
        n0 = _job_count()
        r = backend.run_job({"kind": "driver", "preset": "GW", "VGH": 99,
                             "tft": {"T1": {"G": "CLK1", "S": "FLM", "D": "B"}}})
        self.assertFalse(r.get("ok"))
        self.assertEqual(_job_count(), n0)

    def test_shell_chars(self):
        n0 = _job_count()
        r = backend.run_job({"kind": "driver", "preset": "GW", "tft": {
            "T1": {"G": "CLK1; rm -rf /", "S": "FLM", "D": "B"}}})
        self.assertFalse(r.get("ok"))
        self.assertEqual(_job_count(), n0)
        r2 = backend.run_job({"kind": "pixel", "DATA": "3;evil",
                              "tft": {"T1": {"type": "P", "G": "NG", "S": "NS",
                                            "D": "ND"}}})
        self.assertFalse(r2.get("ok"))
        self.assertEqual(_job_count(), n0)

    def test_pixel_range(self):
        n0 = _job_count()
        r = backend.run_pixel({"kind": "pixel", "DATA": 99})
        self.assertFalse(r.get("ok"))
        self.assertEqual(_job_count(), n0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
