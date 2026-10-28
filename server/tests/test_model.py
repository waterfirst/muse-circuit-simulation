"""Self-check: model compiled from models/ptft_fit.va == gw_lab binary.

1. md5 of server/ptft_fit.osdi equals the reference copy taken from
   ~/gw_lab/ptft_fit.osdi at build time (frozen in models/.gwlab_md5).
2. One EM sim with OSDI_PATH=<compiled> vs OSDI_PATH=<gw_lab file>
   gives identical pass/fail + output extremes.
"""
import hashlib
import os
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SRV = os.path.dirname(HERE)
REPO = os.path.dirname(SRV)


def _md5(path):
    return hashlib.md5(open(path, "rb").read()).hexdigest()


class TestModelEquivalence(unittest.TestCase):
    def test_md5_matches_gwlab(self):
        md5file = os.path.join(REPO, "models", ".gwlab_md5")
        self.assertTrue(os.path.isfile(md5file), "models/.gwlab_md5 missing")
        ref = open(md5file).read().strip()
        mine = _md5(os.path.join(SRV, "ptft_fit.osdi"))
        print("compiled:", mine, "gw_lab:", ref)
        self.assertEqual(mine, ref)

    def test_same_results_both_osdi(self):
        import backend
        gwlab = os.path.expanduser("~/gw_lab/ptft_fit.osdi")
        self.assertTrue(os.path.isfile(gwlab), "gw_lab osdi missing")
        desc = {"kind": "driver", "preset": "EM", "VGH": 8.0, "VGL": -9.5,
                "freq_kHz": 250, "stages": 2, "frames": 1}
        outs = []
        for path in (os.path.join(SRV, "ptft_fit.osdi"), gwlab):
            backend.OSDI_PATH = path
            r = backend.run_job(desc)
            self.assertTrue(r.get("ok"), r.get("errors"))
            outs.append((r["passfail"]["pass"],
                         sorted((k, v.get("extreme"), v.get("width_H"))
                                for k, v in r["passfail"]["stages"].items()),
                         r["job"]))
        backend.OSDI_PATH = os.path.join(SRV, "ptft_fit.osdi")
        print("compiled job:", outs[0][2], "gwlab job:", outs[1][2])
        self.assertEqual(outs[0][:2], outs[1][:2])


if __name__ == "__main__":
    unittest.main(verbosity=2)
