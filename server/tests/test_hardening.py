"""Hardening tests: CORS origin policy, body cap, margin cap, runs prune."""
import json
import os
import threading
import time
import unittest
import urllib.request
import urllib.error
from http.server import HTTPServer

import app as appmod
import aging

URL = "http://127.0.0.1:8770"


def _req(path, obj=None, origin=None, raw=None, method=None):
    data = raw if raw is not None else (
        json.dumps(obj).encode() if obj is not None else None)
    headers = {}
    if origin is not None:
        headers["Origin"] = origin
    if data is not None:
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(URL + path, data=data, headers=headers,
                               method=method or ("POST" if data is not None
                                                 else "GET"))
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def _sim_desc():
    from presets import DRIVER_DEFAULTS
    d = DRIVER_DEFAULTS["GW"]
    return {"circuit": "GW", "preset": "GW", "tft": d["tft"],
            "caps": d["caps"], "start_width_H": d["start_width_H"],
            "polarity": d["polarity"]}


class TestHardening(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = HTTPServer(("127.0.0.1", 8770), appmod.Handler)
        cls.th = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.th.start()
        time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def test_cors_allowed_origin(self):
        code, hdrs, _ = _req("/health",
                             origin="https://waterfirst.pro")
        self.assertEqual(code, 200)
        self.assertEqual(hdrs.get("Access-Control-Allow-Origin"),
                         "https://waterfirst.pro")

    def test_cors_denied_origin(self):
        code, hdrs, body = _req("/health",
                                origin="https://evil.example")
        self.assertEqual(code, 403)
        self.assertNotIn("Access-Control-Allow-Origin", hdrs)

    def test_no_cors_header_for_denied(self):
        # wildcard must be gone: no '*' anywhere
        code, hdrs, _ = _req("/health",
                             origin="https://waterfirst.pro")
        self.assertNotEqual(hdrs.get("Access-Control-Allow-Origin"), "*")

    def test_options_denied(self):
        code, _, _ = _req("/health", origin="https://evil.example",
                          method="OPTIONS")
        self.assertEqual(code, 403)

    def test_post_denied_origin(self):
        code, _, body = _req("/api/sim", obj=_sim_desc(),
                             origin="https://evil.example")
        self.assertEqual(code, 403)

    def test_body_too_large(self):
        big = {"pad": "x" * (appmod.MAX_BODY + 100)}
        code, _, body = _req("/api/sim", obj=big)
        self.assertEqual(code, 413, body[:200])

    def test_margin_public_cap(self):
        code, _, body = _req("/api/margin", obj={
            "desc": _sim_desc(),
            "vgh": [7.0, 7.5, 8.0, 8.5, 9.0],
            "vgl": [0 - 10.5, -9.5]})
        r = json.loads(body)
        self.assertEqual(code, 422, r)
        self.assertTrue(any("max 9 cells" in e for e in r.get("errors", [])),
                        r)

    def test_margin_internal_cap_survives(self):
        # direct call without cap still allows up to 49
        r = aging.start_margin({
            "desc": _sim_desc(),
            "vgh": [7.0, 7.5, 8.0, 8.5, 9.0],
            "vgl": [0 - 10.5, -9.5]}, max_cells=None)
        self.assertTrue(r.get("ok"), r)
        # cleanup: wait then drop from registry
        jid = r["margin_job"]
        for _ in range(60):
            s = aging.margin_status(jid)
            if s and s["state"] != "running":
                break
            time.sleep(2)
        with aging._MJ_LOCK:
            aging.MARGIN_JOBS.pop(jid, None)

    def test_prune_runs_keeps_live_and_caps_count(self):
        from backend import RUNS
        # make fake old dirs
        fakes = []
        for i in range(5):
            d = os.path.join(RUNS, f"_prunetest_{i}")
            os.makedirs(d, exist_ok=True)
            # force old mtime
            old = time.time() - (appmod.RUNS_MAX_AGE_S + 100 + i)
            os.utime(d, (old, old))
            fakes.append(f"_prunetest_{i}")
        with appmod._LIVE_LOCK:
            appmod._LIVE_JOBS.add("_prunetest_0")
        try:
            appmod._prune_runs()
        finally:
            with appmod._LIVE_LOCK:
                appmod._LIVE_JOBS.discard("_prunetest_0")
        self.assertTrue(os.path.isdir(os.path.join(RUNS, "_prunetest_0")),
                        "live job must survive prune")
        for n in fakes[1:]:
            self.assertFalse(os.path.isdir(os.path.join(RUNS, n)),
                             f"stale {n} must be pruned")
        # cleanup live marker dir
        import shutil
        shutil.rmtree(os.path.join(RUNS, "_prunetest_0"),
                      ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
