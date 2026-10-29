"""10T2C GW auto-optimizer: clk2 multi-window + hill-climb on W/L/C.

Runs in background (thread), polled via GET /api/opt/status.
Keeps the muse netlist topology fixed; only clock windows and sizes change.
"""
import copy
import math
import os
import random
import threading
import time
import uuid

import numpy as np

import backend
from backend import validate_driver, build_driver_cir, _run_ngspice, RUNS

_OPT = {"running": False, "job": None, "result": None, "log": []}
_LOCK = threading.Lock()

# muse 10T2C baseline sizes (W um) and L=4um
BASE_W = {1: 6, 2: 6, 3: 6, 4: 60, 5: 12, 6: 6, 7: 100, 8: 12, 9: 200, 10: 300}
BASE_L = {i: 4.0 for i in range(1, 11)}
BASE_C = {"C1": 1.0, "C2": 2.0}


def _frames_of(arr, header, vgh=8.0, vgl=-8.0, hi_thr=6.0, lo_thr=-6.0,
               min_w=1.5, max_w=8.0):
    """Count frame pulses: OUT rises above hi_thr then falls below lo_thr
    within min_w..max_w us. Returns list of (start, end)."""
    idx = {n: i for i, n in enumerate(header)}
    t = arr[:, 0] * 1e6
    o = arr[:, idx["v(OUT1)"]] if "v(OUT1)" in idx else arr[:, idx["v(out)"]]
    frames = []
    i, n = 0, len(t)
    while i < n:
        if o[i] < hi_thr:
            i += 1
            continue
        s = t[i]
        j = i
        while j < n and o[j] > lo_thr:
            j += 1
        if j < n:
            w = t[j] - s
            if min_w <= w <= max_w:
                frames.append((round(float(s), 2), round(float(t[j]), 2)))
        i = j + 1 if j > i else i + 1
    return frames


def _trial(desc, W, L, C, clk2_starts, tag):
    from presets import DRIVER_DEFAULTS
    d = copy.deepcopy(desc)
    preset = str(d.get("preset", "GW"))
    if preset not in DRIVER_DEFAULTS:
        preset = "GW"
    dflt = DRIVER_DEFAULTS.get(preset, DRIVER_DEFAULTS["GW"])
    # fill full tft entries from preset defaults, then override W/L
    tft = {}
    for i in range(1, 13):
        key = f"T{i}"
        if key in dflt["tft"]:
            tft[key] = dict(dflt["tft"][key])
    for key, e in (d.get("tft") or {}).items():
        if key in tft:
            tft[key].update(e)
        else:
            tft[key] = dict(e)
    for i in range(1, 11):
        key = f"T{i}"
        if key in tft:
            tft[key]["W"] = round(float(W[i]), 2)
            tft[key]["L"] = round(float(L[i]), 2)
    d["tft"] = tft
    # fill caps from preset defaults, then override C1/C2 values
    caps = [dict(c) for c in dflt["caps"]]
    by_name = {c.get("name"): c for c in caps}
    for k, v in C.items():
        if k in by_name:
            by_name[k]["pf"] = round(float(v), 3)
    d["caps"] = caps
    d["clk2_starts"] = list(clk2_starts)
    errors, warnings, suggestions, norm = validate_driver(d)
    if errors:
        return None
    jid = f"opt_{tag}"
    jobdir = os.path.abspath(os.path.join(RUNS, jid))
    os.makedirs(jobdir, exist_ok=True)
    cir, info = build_driver_cir(norm, jobdir)
    out, err = _run_ngspice(jobdir, cir)
    if out is None:
        return None
    arr, header = out
    frames = _frames_of(arr, header, norm["VGH"], norm["VGL"])
    o = arr[:, 1]
    return {"n": len(frames), "frames": frames,
            "mn": round(float(arr[:, -1].min()), 2),
            "mx": round(float(arr[:, -1].max()), 2),
            "cir": open(cir).read()}


def _mutate(W, L, C, s):
    W2 = {k: float(np.clip(v * math.exp(random.gauss(0, s)), 2, 600))
          for k, v in W.items()}
    L2 = {k: float(np.clip(v * math.exp(random.gauss(0, s)), 1.0, 15))
          for k, v in L.items()}
    C2 = dict(C)
    for k in ("C1", "C2"):
        C2[k] = float(np.clip(C[k] * math.exp(random.gauss(0, s)), 0.1, 10))
    return W2, L2, C2


def _run(desc, iters, clk2_starts, seed):
    random.seed(seed)
    base_C = dict(BASE_C)
    W0 = {i: float(BASE_W[i]) for i in range(1, 11)}
    L0 = dict(BASE_L)
    best = _trial(desc, W0, L0, base_C, clk2_starts, f"{seed}_0")
    if best is None:
        return {"ok": False, "errors": ["baseline sim failed"]}
    cur = (best["n"], W0, L0, base_C)
    hist = [best["n"]]
    for it in range(iters):
        s = 0.35 if it < iters // 2 else 0.15
        W2, L2, C2 = _mutate(cur[1], cur[2], cur[3], s)
        r = _trial(desc, W2, L2, C2, clk2_starts, f"{seed}_{it+1}")
        with _LOCK:
            _OPT["log"].append(f"iter {it+1}/{iters}: n={r['n'] if r else 'FAIL'}")
            _OPT["log"] = _OPT["log"][-50:]
        if r and r["n"] >= cur[0]:
            cur = (r["n"], W2, L2, C2)
            if r["n"] > best["n"]:
                best = dict(r)
                best.update({"W": {k: round(v, 2) for k, v in W2.items()},
                             "L": {k: round(v, 2) for k, v in L2.items()},
                             "C": {k: round(v, 3) for k, v in C2.items()}})
        hist.append(cur[0])
    best.setdefault("W", {k: round(v, 2) for k, v in cur[1].items()})
    best.setdefault("L", {k: round(v, 2) for k, v in cur[2].items()})
    best.setdefault("C", {k: round(v, 3) for k, v in cur[3].items()})
    return {"ok": True, "best": best, "history": hist}


def start_opt(desc, iters=60, clk2_starts=None, seed=1):
    with _LOCK:
        if _OPT["running"]:
            return {"ok": False, "errors": ["optimizer already running"]}
        jid = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
        _OPT.update(running=True, job=jid, result=None, log=["started"])
    if clk2_starts is None:
        clk2_starts = [16, 26, 36, 46, 56]

    def _bg():
        try:
            res = _run(desc, iters, clk2_starts, seed)
            res["job"] = jid
            with _LOCK:
                _OPT["result"] = res
                _OPT["log"].append("done")
        except Exception as exc:  # noqa: BLE001
            with _LOCK:
                _OPT["result"] = {"ok": False,
                                  "errors": [f"{type(exc).__name__}: {exc}"]}
        finally:
            with _LOCK:
                _OPT["running"] = False

    threading.Thread(target=_bg, daemon=True).start()
    return {"ok": True, "job": jid}


def opt_status():
    with _LOCK:
        return {"running": _OPT["running"], "job": _OPT["job"],
                "result": _OPT["result"], "log": list(_OPT["log"])}
