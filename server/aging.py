#!/usr/bin/env python3
"""Aging: BTS stress estimator + VGHxVGL margin maps for gw-react.

- Stress: run the FRESH circuit, measure each TFT's gate-bias stress from its
  own waveforms (time-weighted over full frames), convert to dVth/ion/ioff/ss
  with a documented power-law + Arrhenius BTS law (coefficients synthetic).
- Margin: background VGH x VGL grid sweep, degraded vs fresh side by side.
"""
import copy
import json
import math
import os
import threading
import time
import uuid

import numpy as np

import backend

K_EV = 8.617333e-5   # eV/K
TREF_K = 298.15

# ---- BTS law defaults (SYNTHETIC ASSUMPTIONS, see docs/ASSUMPTIONS.md) ----
# Form: dVth = A_pol * t_h^n * arrhenius(T) * bias_stress, after the
# power-law / stretched-exponential BTS form standard in TFT literature
# (Powell 1989 a-Si:H tradition; exact coefs here are synthetic).
STRESS_DEFAULTS = {
    "A_P": 0.005, "A_N": 0.003,  # V at 1h, unit stress, Tref
    "N_T": 0.35,                # time exponent
    "Ea_eV": 0.35,              # Arrhenius activation energy
    "V0": 5.0,                  # on-bias normalizer (V)
    "V0off": 10.0,              # off-bias normalizer (V)
    "G_ON": 1.5, "G_OFF": 1.0,  # bias exponents
    "A_MU": 0.1,                # ion = 1/(1+A_MU*dVth)
    "A_OFF": 0.5,               # ioff = 1+A_OFF*dVth
    "A_SS": 0.05,               # ss = 1+A_SS*dVth
}
STRESS_RANGES = {
    "A_P": (0, 2), "A_N": (0, 2), "N_T": (0.05, 1.0), "Ea_eV": (0, 1.5),
    "V0": (0.5, 30), "V0off": (0.5, 30), "G_ON": (0, 3), "G_OFF": (0, 3),
    "A_MU": (0, 5), "A_OFF": (0, 5), "A_SS": (0, 5),
}
LAW_NOTE = ("dVth=A_pol*t^N_T*exp(Ea/k*(1/Tref-1/T))*bias, "
            "bias=duty_on*(Von/V0)^G_ON+(1-duty_on)*(|Voff|/V0off)^G_OFF; "
            "ion=1/(1+A_MU*dVth), ioff=1+A_OFF*dVth, ss=1+A_SS*dVth. "
            "Power-law+Arrhenius BTS form (TFT-literature tradition); "
            "coefficients synthetic assumptions.")


def _load_trace(jobdir):
    lines = open(os.path.join(jobdir, "out.txt")).read().splitlines()
    header = lines[0].split()
    arr = np.array([[float(x) for x in ln.split()] for ln in lines[1:]])
    idx = {h.lower(): i for i, h in enumerate(header)}
    return arr, header, idx


def _weights(t):
    """Trapezoid weights for non-uniform ngspice steps (time-weighted avgs)."""
    w = np.zeros_like(t)
    if len(t) < 2:
        return np.ones_like(t)
    w[0] = 0.5 * (t[1] - t[0])
    w[-1] = 0.5 * (t[-1] - t[-2])
    w[1:-1] = 0.5 * (t[2:] - t[:-2])
    return np.abs(w)


def _fresh_desc(desc):
    d = copy.deepcopy(desc)
    tft = d.get("tft", {})
    for p in tft.values():
        if isinstance(p, dict):
            p["dVth"] = 0.0
            p["ion"] = 1.0
            p["ioff"] = 1.0
            p["ss"] = 1.0
    d["temp_C"] = 25.0
    return d


# ================= STRESS =================
def run_stress(payload):
    """payload: {desc, temp_C, hours, coefs?} -> per-TFT degradation table."""
    if not isinstance(payload, dict) or "desc" not in payload:
        return {"ok": False, "errors": ["need {desc, temp_C, hours}"]}
    desc = payload["desc"]
    errs = []
    temp = backend._num(payload.get("temp_C", 85.0))
    if temp is None or not (-40 <= temp <= 150):
        errs.append(f"temp_C {payload.get('temp_C')!r}: must be -40..150")
    hours = backend._num(payload.get("hours", 500.0))
    if hours is None or not (0 <= hours <= 100000):
        errs.append(f"hours {payload.get('hours')!r}: must be 0..100000")
    coefs = dict(STRESS_DEFAULTS)
    for k, v in (payload.get("coefs") or {}).items():
        if k not in STRESS_DEFAULTS:
            errs.append(f"unknown coef {k!r}")
            continue
        f = backend._num(v)
        lo, hi = STRESS_RANGES[k]
        if f is None or not (lo <= f <= hi):
            errs.append(f"coef {k} {v!r}: must be {lo}..{hi}")
        else:
            coefs[k] = f
    if errs:
        return {"ok": False, "errors": errs}
    is_pixel = isinstance(desc, dict) and desc.get("kind") == "pixel"
    if is_pixel:
        verr, _, g = backend.validate_pixel(desc)
        key = "pixel"
    else:
        verr, _, _, norm = backend.validate_driver(desc or {})
        key = "driver"
    if verr:
        return {"ok": False, "errors": verr}

    # NOTE: caller (HTTP handler) holds SIM_LOCK; do not re-acquire here
    # (threading.Semaphore is not re-entrant). Margin workers lock per cell.
    r = backend.run_job(_fresh_desc(desc if isinstance(desc, dict)
                                    else {"kind": "driver"}))
    if not r.get("ok"):
        return {"ok": False, "errors": r.get("errors", ["fresh run failed"])}
    jobdir = os.path.join(backend.RUNS, r["job"])
    arr, header, idx = _load_trace(jobdir)
    t = arr[:, 0] * 1e6  # us

    if is_pixel:
        F = r["info"]["frame_us"]
        w0, w1 = F, 2 * F
        tft = g["tft"]
        consts = {k: g[k] for k in
                  ("ELVDD", "ELVSS", "VINT", "VOBS", "DATA", "VGH", "VGL")}

        def vnode(net):
            if net in consts:
                return np.full_like(t, consts[net])
            return arr[:, idx["v(%s)" % net.lower()]]

        def pol_vt0(p):
            pol = 1 if p["type"] == "P" else -1
            return pol, (g["VT0_P"] if pol > 0 else g["VT0_N"])
    else:
        info = r["info"]
        w0, w1 = info["T0s"][0], info["TEND"]
        tft = norm["tft"]
        vgh, vgl = norm["VGH"], norm["VGL"]

        def vnode(net):
            if net == "VGH":
                return np.full_like(t, vgh)
            if net == "VGL":
                return np.full_like(t, vgl)
            if net in ("FLM", "IN"):
                return arr[:, idx["v(flm)"]]
            if net == "CLK1":
                return arr[:, idx["v(clk1)"]]
            if net == "CLK2":
                return arr[:, idx["v(clk2)"]]
            if net == "OUT":
                return arr[:, idx["v(out1)"]]  # stage-1 device
            return arr[:, idx["v(x1.%s)" % net.lower()]]

        def pol_vt0(p):
            return p["POL"], p["VT0"]

    m = (t >= w0) & (t <= w1)
    tw, w = t[m], _weights(t[m])
    wsum = w.sum()
    TK = temp + 273.15
    arrh = math.exp((coefs["Ea_eV"] / K_EV) * (1 / TREF_K - 1 / TK))
    table = []
    for name in sorted(tft, key=lambda s: int(s[1:])):
        p = tft[name]
        pol, vt0 = pol_vt0(p)
        vs, vg, vd = vnode(p["S"])[m], vnode(p["G"])[m], vnode(p["D"])[m]
        vdrive = pol * (vs - vg)     # >0 toward on; on iff > VT0
        vsd = np.abs(pol * (vs - vd))
        on = vdrive > vt0
        won = w[on].sum()
        duty = won / wsum if wsum else 0.0
        von = float((w[on] * vdrive[on]).sum() / won) if won else 0.0
        woff = wsum - won
        voff = float((w[~on] * vdrive[~on]).sum() / woff) if woff else 0.0
        vsd_m = float((w * vsd).sum() / wsum) if wsum else 0.0
        bias = (duty * (max(von, 0) / coefs["V0"]) ** coefs["G_ON"]
                + (1 - duty) * (max(-voff, 0) / coefs["V0off"])
                ** coefs["G_OFF"])
        A = coefs["A_P"] if pol > 0 else coefs["A_N"]
        dvth = float(A * (hours ** coefs["N_T"]) * arrh * bias
                     if hours > 0 else 0.0)
        table.append({
            "tft": name, "duty_on": round(float(duty), 4),
            "von_V": round(von, 3), "voff_V": round(voff, 3),
            "vsd_V": round(vsd_m, 3),
            "dVth": round(dvth, 4),
            "ion": round(float(1 / (1 + coefs["A_MU"] * dvth)), 4),
            "ioff": round(float(1 + coefs["A_OFF"] * dvth), 4),
            "ss": round(float(1 + coefs["A_SS"] * dvth), 4),
        })
    return {"ok": True, "kind": key, "job": r["job"],
            "window_us": [round(w0, 2), round(w1, 2)],
            "temp_C": temp, "hours": hours, "coefs": coefs,
            "law": LAW_NOTE,
            "weight_note": ("driver" if not is_pixel else "pixel") + (
                ": window covers whole simulated frames (scan+hold by "
                "construction, frame = K clock periods), so duty cycles "
                "directly represent real-frame-rate operation; avgs are "
                "trapezoid time-weighted over non-uniform steps."
                if not is_pixel else
                ": window is frame 2 (F..2F); avgs trapezoid time-weighted."),
            "table": table}


# ================= MARGIN MAP =================
MARGIN_JOBS = {}
_MJ_LOCK = threading.Lock()
MAX_CELLS = 49


def _strip_for_fresh(desc):
    return _fresh_desc(desc)


def start_margin(payload):
    if not isinstance(payload, dict) or "desc" not in payload:
        return {"ok": False, "errors": ["need {desc, vgh:[...], vgl:[...]}"]}
    desc = payload["desc"]
    errs = []
    lists = {}
    for k, rng in (("vgh", backend.VGH_RANGE), ("vgl", backend.VGL_RANGE)):
        vs = payload.get(k)
        if not isinstance(vs, list) or not (2 <= len(vs) <= 9):
            errs.append(f"{k}: need a list of 2..9 numbers")
            continue
        fs = []
        for v in vs:
            f = backend._num(v)
            if f is None or not (rng[0] <= f <= rng[1]):
                errs.append(f"{k} value {v!r} out of range {rng}")
            else:
                fs.append(f)
        lists[k] = fs
    if errs:
        return {"ok": False, "errors": errs}
    if len(lists["vgh"]) * len(lists["vgl"]) > MAX_CELLS:
        return {"ok": False, "errors": [f"grid too big (max {MAX_CELLS} cells)"]}
    is_pixel = isinstance(desc, dict) and desc.get("kind") == "pixel"
    verr = (backend.validate_pixel(desc)[0] if is_pixel
            else backend.validate_driver(desc or {})[0])
    if verr:
        return {"ok": False, "errors": verr}
    jid = ("margin_" + time.strftime("%Y%m%d_%H%M%S")
           + "_" + uuid.uuid4().hex[:6])
    nominal = {"VGH": float(desc.get("VGH", desc.get("vgh", 8.0))),
               "VGL": float(desc.get("VGL", desc.get("vgl", -9.5)))}
    job = {"state": "running", "done": 0,
           "total": 2 * len(lists["vgh"]) * len(lists["vgl"]),
           "kind": "pixel" if is_pixel else "driver",
           "vgh": lists["vgh"], "vgl": lists["vgl"], "nominal": nominal,
           "grids": {"degraded": [], "fresh": []}, "error": ""}
    with _MJ_LOCK:
        MARGIN_JOBS[jid] = job
    th = threading.Thread(target=_margin_worker,
                          args=(jid, desc, lists, is_pixel), daemon=True)
    th.start()
    return {"ok": True, "margin_job": jid, "total": job["total"]}


def _margin_worker(jid, desc, lists, is_pixel):
    try:
        ref_i = None
        # reference: fresh device at nominal rails (for pixel %)
        if is_pixel:
            nom = dict(desc)
            d0 = _strip_for_fresh(nom)
            with backend.SIM_LOCK:
                rr = backend.run_job(d0)
            if rr.get("ok"):
                ref_i = rr["result"]["i_emission_uA"]
        for variant in ("degraded", "fresh"):
            grid = []
            for gh in lists["vgh"]:
                row = []
                for gl in lists["vgl"]:
                    cell = copy.deepcopy(desc)
                    cell["VGH"], cell["VGL"] = gh, gl
                    if variant == "fresh":
                        cell = _strip_for_fresh(cell)
                    with backend.SIM_LOCK:
                        r = backend.run_job(cell)
                    if not r.get("ok"):
                        row.append({"ok": False, "job": r.get("job", ""),
                                    "err": ";".join(r.get("errors", []))[:120]})
                    elif is_pixel:
                        i = r["result"]["i_emission_uA"]
                        pct = ((i - ref_i) / ref_i * 100
                               if ref_i else 0.0)
                        row.append({"ok": True, "job": r["job"], "i_uA": i,
                                    "pct": round(pct, 2)})
                    else:
                        pf = r["passfail"]
                        row.append({"ok": True, "job": r["job"],
                                    "pass": pf["pass"],
                                    "nfail": sum(1 for s in
                                                 pf["stages"].values()
                                                 if not s["pass"])})
                    with _MJ_LOCK:
                        MARGIN_JOBS[jid]["done"] += 1
                grid.append(row)
            with _MJ_LOCK:
                MARGIN_JOBS[jid]["grids"][variant] = grid
        with _MJ_LOCK:
            MARGIN_JOBS[jid]["ref_i_uA"] = ref_i
            MARGIN_JOBS[jid]["state"] = "done"
        mdir = os.path.join(backend.RUNS, jid)
        os.makedirs(mdir, exist_ok=True)
        with _MJ_LOCK:
            snap = dict(MARGIN_JOBS[jid])
        open(os.path.join(mdir, "summary.json"), "w").write(
            json.dumps(snap, ensure_ascii=False, indent=1))
    except Exception as exc:  # keep failure visible
        with _MJ_LOCK:
            MARGIN_JOBS[jid]["state"] = "error"
            MARGIN_JOBS[jid]["error"] = f"{type(exc).__name__}: {exc}"


def margin_status(jid):
    with _MJ_LOCK:
        job = MARGIN_JOBS.get(jid)
        if job is None:
            # maybe finished in an earlier poll cycle: check runs dir
            fp = os.path.join(backend.RUNS, jid, "summary.json")
            if os.path.isfile(fp):
                snap = json.loads(open(fp).read())
                snap["margin_job"] = jid
                return snap
            return None
        snap = json.loads(json.dumps(job))
    snap["margin_job"] = jid
    return snap
