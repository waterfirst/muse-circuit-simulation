"""gw-react sim server on 127.0.0.1:8768. No tunnels, localhost only."""
import json
import threading as _th
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

import backend
from backend import run_job
from presets import DRIVER_DEFAULTS, PIXEL_DEFAULTS, PIXEL_TFT
import aging

HERE = Path(__file__).resolve().parent
_SIM_LOCK = backend.SIM_LOCK


class Handler(BaseHTTPRequestHandler):
    server_version = "GWReact/1.0"

    def _send(self, status, payload, ctype="application/json; charset=utf-8"):
        body = payload if isinstance(payload, bytes) else json.dumps(
            payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, b"")

    def do_GET(self):
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

    def do_POST(self):
        if self.path not in ("/api/sim", "/api/pixel", "/api/stress",
                             "/api/margin"):
            self._send(404, {"error": "not found"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 65536:
                self._send(413, {"error": "body must be 1-65536 bytes"})
                return
            desc = json.loads(self.rfile.read(size))
        except (ValueError, json.JSONDecodeError):
            self._send(400, {"ok": False, "errors": ["invalid JSON body"],
                             "warnings": [], "suggestions": []})
            return
        if self.path == "/api/margin":
            # background job: returns immediately, poll via GET
            try:
                result = aging.start_margin(desc)
            except Exception as exc:
                self._send(500, {"ok": False,
                                 "errors": [f"backend error: {type(exc).__name__}"]})
                return
            self._send(202 if result.get("ok") else 422, result)
            return
        if not _SIM_LOCK.acquire(blocking=False):
            self._send(429, {"ok": False, "errors": ["another simulation is running"],
                             "warnings": [], "suggestions": []})
            return
        try:
            try:
                if self.path == "/api/stress":
                    result = aging.run_stress(desc)
                else:
                    result = run_job(desc)
            except Exception as exc:
                self._send(500, {"ok": False,
                                 "errors": [f"backend error: {type(exc).__name__}"],
                                 "warnings": [], "suggestions": []})
                return
        finally:
            _SIM_LOCK.release()
        self._send(200 if result.get("ok") else 422, result)

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    import os as _os
    _host = _os.environ.get("BIND_HOST", "127.0.0.1")
    print(f"gw-react sim on http://{_host}:8768 (Ctrl+C to stop)")
    HTTPServer((_host, 8768), Handler).serve_forever()
