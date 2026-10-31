"""gw-react sim server on 127.0.0.1:8768. No tunnels, localhost only."""
import json
import os as _os
import threading as _th
import time as _time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

import backend
from backend import run_job
from presets import DRIVER_DEFAULTS, PIXEL_DEFAULTS, PIXEL_TFT
import aging

HERE = Path(__file__).resolve().parent

# ---- public-deploy hardening (deployment-hardening branch) ----
# CORS: same-origin only in production. Local dev (npm run dev /
# vite preview on localhost) needs no CORS header because the
# frontend falls back to http://127.0.0.1:8768 via fetch, which is
# same-host loopback — the browser still enforces CORS, so keep
# localhost origins allowed for dev convenience.
ALLOWED_ORIGINS = frozenset({
    "https://waterfirst.pro",
    "http://127.0.0.1:8768",
    "http://localhost:8768",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
})

# Request body cap: app-level guard stricter than nginx's 128k,
# so direct-to-backend abuse (Tailscale) is also bounded.
MAX_BODY = 65536

# Single-request wall-clock guard. ngspice itself has a 300s
# subprocess timeout; this wraps the whole handler (validate +
# simulate + serialize) so a stuck request cannot hold SIM_LOCK
# forever. Margin jobs are backgrounded and exempt.
REQUEST_TIMEOUT_S = float(_os.environ.get("SIM_TIMEOUT_S", "320"))

# Public margin cap: internal MAX_CELLS (49) stays for local
# research, but unauthenticated public use is capped lower.
# 3x3 = 9 cells x2 variants = 18 sims max per request.
PUBLIC_MAX_CELLS = int(_os.environ.get("PUBLIC_MAX_CELLS", "9"))

# runs/ retention: cap + age. Pruned at startup and after each
# completed sim job. Jobs currently running are never deleted.
RUNS_KEEP = int(_os.environ.get("RUNS_KEEP", "200"))
RUNS_MAX_AGE_S = int(_os.environ.get("RUNS_MAX_AGE_S",
                                     str(7 * 24 * 3600)))
_LIVE_JOBS = set()
_LIVE_LOCK = _th.Lock()

_SIM_LOCK = backend.SIM_LOCK


def _prune_runs():
    """Delete oldest runs/ dirs beyond count/age limits.

    Skips: live job dirs, margin snapshots still tracked in
    MARGIN_JOBS, non-directory entries. Best-effort, never raises.
    """
    try:
        from backend import RUNS
        import shutil
        with _LIVE_LOCK:
            live = set(_LIVE_JOBS)
        try:
            with aging._MJ_LOCK:
                live |= set(aging.MARGIN_JOBS.keys())
        except Exception:
            pass
        entries = []
        for name in _os.listdir(RUNS):
            if name in live:
                continue
            p = _os.path.join(RUNS, name)
            if not _os.path.isdir(p):
                continue
            try:
                entries.append((_os.path.getmtime(p), name, p))
            except OSError:
                continue
        now = _time.time()
        # age first
        for mtime, name, p in entries:
            if now - mtime > RUNS_MAX_AGE_S:
                shutil.rmtree(p, ignore_errors=True)
        # recount survivors, then count cap (oldest first)
        entries = [(m, n, p) for (m, n, p) in entries
                   if _os.path.isdir(p)]
        entries.sort()
        overflow = len(entries) - RUNS_KEEP
        for _, _, p in entries[:max(0, overflow)]:
            shutil.rmtree(p, ignore_errors=True)
    except Exception:
        pass


class Handler(BaseHTTPRequestHandler):
    server_version = "GWReact/1.0"

    def _origin(self):
        return self.headers.get("Origin")

    def _cors_headers(self, origin):
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _send(self, status, payload, ctype="application/json; charset=utf-8",
              origin=None):
        body = payload if isinstance(payload, bytes) else json.dumps(
            payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if origin is None:
            origin = self._origin()
        if origin:
            self._cors_headers(origin)
        self.send_header("Access-Control-Allow-Methods",
                         "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def _reject_bad_origin(self):
        """Cross-origin requests from non-allowlisted origins -> 403.

        Same-origin / non-browser (no Origin header) requests pass.
        """
        origin = self._origin()
        if origin is not None and origin not in ALLOWED_ORIGINS:
            self._send(403, {"ok": False,
                             "errors": ["origin not allowed"]},
                       origin=origin)
            return False
        return True

    def do_OPTIONS(self):
        origin = self._origin()
        if origin is not None and origin not in ALLOWED_ORIGINS:
            self._send(403, b"", origin=origin)
            return
        self._send(204, b"", origin=origin)

    def do_GET(self):
        if not self._reject_bad_origin():
            return
        u = urlparse(self.path)
        if u.path == "/health":
            self._send(200, {"status": "ok"})
        elif u.path == "/api/presets":
            out = {}
            for k, v in DRIVER_DEFAULTS.items():
                out[k] = {"polarity": v["polarity"],
                          "start_width_H": v["start_width_H"],
                          "tft": v["tft"], "caps": v["caps"]}
            out["PIXEL"] = {"defaults": PIXEL_DEFAULTS, "tft": PIXEL_TFT}
            self._send(200, out)
        elif u.path == "/api/margin":
            from urllib.parse import parse_qs
            q = parse_qs(u.query)
            jid = (q.get("id") or [""])[0]
            if not jid or ".." in jid or "/" in jid:
                self._send(400, {"error": "need ?id=<margin_job>"})
                return
            snap = aging.margin_status(jid)
            if snap is None:
                self._send(404, {"error": "unknown margin job"})
            else:
                self._send(200, snap)
        elif u.path.startswith("/runs/"):
            # serve saved deck/log/trace: /runs/<job>/<file>
            parts = u.path[len("/runs/"):].split("/")
            if len(parts) == 2 and all(
                    p and ".." not in p and "/" not in p for p in parts):
                fp = HERE / "runs" / parts[0] / parts[1]
                if fp.is_file() and fp.stat().st_size < 20_000_000:
                    ctype = "text/plain; charset=utf-8"
                    if parts[1].endswith(".json"):
                        ctype = "application/json; charset=utf-8"
                    self._send(200, fp.read_bytes(), ctype)
                    return
            self._send(404, {"error": "not found"})
        else:
            self._send(404, {"error": "not found"})

    def _run_with_timeout(self, fn):
        """Run fn() with a wall-clock guard. Returns (ok, result).

        ok=False means the timeout fired; the worker thread keeps
        running to completion in the background (SIM_LOCK is
        released by finally in the caller path).
        """
        box = {}
        done = _th.Event()

        def _w():
            try:
                box["r"] = fn()
            except Exception as exc:  # keep error shape consistent
                box["r"] = {"ok": False, "errors": [
                    f"backend error: {type(exc).__name__}"]}
            finally:
                done.set()

        t = _th.Thread(target=_w, daemon=True)
        t.start()
        if done.wait(REQUEST_TIMEOUT_S):
            return True, box.get("r", {"ok": False,
                                       "errors": ["empty result"]})
        return False, None

    def do_POST(self):
        if not self._reject_bad_origin():
            return
        if self.path not in ("/api/sim", "/api/pixel", "/api/stress",
                             "/api/margin"):
            self._send(404, {"error": "not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > MAX_BODY:
                self._send(413, {"ok": False,
                                 "errors": [f"body must be 1-{MAX_BODY} "
                                            "bytes"],
                                 "warnings": [], "suggestions": []})
                return
            desc = json.loads(self.rfile.read(size))
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"ok": False, "errors": ["invalid JSON body"],
                             "warnings": [], "suggestions": []})
            return
        if self.path == "/api/margin":
            # background job: returns immediately, poll via GET
            try:
                result = aging.start_margin(desc,
                                            max_cells=PUBLIC_MAX_CELLS)
            except Exception as exc:
                self._send(500, {"ok": False,
                                 "errors": [f"backend error: "
                                            f"{type(exc).__name__}"]})
                return
            self._send(202 if result.get("ok") else 422, result)
            return
        if not _SIM_LOCK.acquire(blocking=False):
            self._send(429, {"ok": False, "errors": ["another simulation is running"],
                             "warnings": [], "suggestions": []})
            return
        try:
            if self.path == "/api/stress":
                finished, result = self._run_with_timeout(
                    lambda: aging.run_stress(desc))
            else:
                finished, result = self._run_with_timeout(
                    lambda: run_job(desc))
            if not finished:
                self._send(504, {"ok": False,
                                 "errors": [f"simulation timed out after "
                                            f"{REQUEST_TIMEOUT_S:g}s"],
                                 "warnings": [], "suggestions": []})
                return
            if not isinstance(result, dict):
                result = {"ok": False, "errors": ["empty result"],
                          "warnings": [], "suggestions": []}
        finally:
            _SIM_LOCK.release()
        if result.get("ok") and result.get("job"):
            with _LIVE_LOCK:
                _LIVE_JOBS.add(result["job"])
            try:
                _prune_runs()
            finally:
                with _LIVE_LOCK:
                    _LIVE_JOBS.discard(result["job"])
        self._send(200 if result.get("ok") else 422, result)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    import os as _os
    _host = _os.environ.get("BIND_HOST", "127.0.0.1")
    _prune_runs()
    print(f"gw-react sim on http://{_host}:8768 (Ctrl+C to stop)")
    HTTPServer((_host, 8768), Handler).serve_forever()
