"""gw-react sim server on 127.0.0.1:8768. No tunnels, localhost only."""
import json
import threading as _th
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

from backend import run_job
from presets import DRIVER_DEFAULTS, PIXEL_DEFAULTS, PIXEL_TFT

HERE = Path(__file__).resolve().parent
_SIM_LOCK = _th.Semaphore(1)


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
        if self.path not in ("/api/sim", "/api/pixel"):
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
        if not _SIM_LOCK.acquire(blocking=False):
            self._send(429, {"ok": False, "errors": ["another simulation is running"],
                             "warnings": [], "suggestions": []})
            return
        try:
            try:
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
    print("gw-react sim on http://127.0.0.1:8768 (Ctrl+C to stop)")
    HTTPServer(("127.0.0.1", 8768), Handler).serve_forever()
