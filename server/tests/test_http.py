"""Self-check: HTTP layer (/api/sim, /api/stress, /api/margin) over real sockets."""
import json
import threading
import time
import unittest
import urllib.request
from http.server import HTTPServer

import app as appmod

URL = "http://127.0.0.1:8769"


def _post(path, obj):
    req = urllib.request.Request(
        URL + path, data=json.dumps(obj).encode(),
        headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=280) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())


def _get(path):
    with urllib.request.urlopen(URL + path, timeout=30) as r:
        return json.loads(r.read())


class TestHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = HTTPServer(("127.0.0.1", 8769), appmod.Handler)
        cls.th = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.th.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_sim_degraded_hot(self):
        code, r = _post("/api/sim", {
            "kind": "driver", "preset": "EM", "VGH": 8.0, "VGL": -9.5,
            "freq_kHz": 250, "stages": 2, "frames": 1, "temp_C": 85,
            "tft": {"T3": {"G": "VGL", "S": "N1", "D": "N3", "W": 4,
                            "L": 4.5, "type": "P", "dVth": 0.5, "ion": 0.8,
                            "ioff": 2.0, "ss": 1.1}}})
        self.assertIn(code, (200, 422), r)
        print("sim degraded+hot:", code, "job=", r.get("job"))

    def test_stress(self):
        code, r = _post("/api/stress", {
            "desc": {"kind": "driver", "preset": "GW", "VGH": 8.0,
                     "VGL": -9.5, "freq_kHz": 250, "stages": 2, "frames": 1},
            "temp_C": 85, "hours": 100})
        self.assertEqual(code, 200, r)
        self.assertTrue(r["ok"])
        self.assertEqual(len(r["table"]), 9)
        print("stress GW rows:", len(r["table"]), "job=", r["job"],
              "T6:", [x for x in r["table"] if x["tft"] == "T6"][0])

    def test_margin(self):
        code, r = _post("/api/margin", {
            "desc": {"kind": "driver", "preset": "EM", "VGH": 8.0,
                     "VGL": -9.5, "freq_kHz": 250, "stages": 2, "frames": 1},
            "vgh": [7.0, 9.0], "vgl": [-10.5, -8.5]})
        self.assertEqual(code, 202, r)
        jid = r["margin_job"]
        for _ in range(90):
            s = _get("/api/margin?id=" + jid)
            if s["state"] != "running":
                break
            time.sleep(2)
        self.assertEqual(s["state"], "done", s)
        self.assertEqual(s["done"], s["total"])
        print("margin:", jid, s["done"], "cells ok")


if __name__ == "__main__":
    unittest.main(verbosity=2)
