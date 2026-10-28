#!/usr/bin/env python3
"""gw-react backend: driver (GW/EM/GC/GI) + 8T1C pixel simulator.

Strict JSON in -> validated netlist -> ngspice (ptft_fit.osdi) ->
downsampled waveforms + pass/fail. All work in server/runs/<job>/.
"""
import json, os, re, subprocess, time, uuid
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
RUNS = os.path.join(HERE, "runs")
os.makedirs(RUNS, exist_ok=True)

from presets import DRIVER_DEFAULTS, PIXEL_DEFAULTS, PIXEL_TFT  # noqa: E402

# ---------- shared validation helpers ----------
NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")
SHELL_RE = re.compile(r"[;&|`$()<>!*?~#\\'\"/\s]")

PINS = {"G", "S", "D"}
D_GLOBAL = {"VGH", "VGL", "FLM", "CLK1", "CLK2"}
D_INTERNAL = {"A", "B", "C", "Q", "QB"} | {f"N{i}" for i in range(1, 9)}
D_VALID = D_GLOBAL | D_INTERNAL | {"OUT", "IN"}
D_T = {f"T{i}" for i in range(1, 13)}

P_NETS = {"ELVDD", "ELVSS", "VINT", "VOBS", "DATA", "VGH", "VGL",
          "GI", "GC", "GW", "EM", "GO", "NG", "NS", "ND", "ANODE"}
P_T = {f"T{i}" for i in range(1, 9)}

VGH_RANGE = (4.0, 12.0)
VGL_RANGE = (-14.0, -4.0)
FREQ_RANGE = (30.0, 500.0)
N_RANGE = (1, 12)
W_RANGE = (0.5, 500.0)     # um
L_RANGE = (2.0, 50.0)      # um
CAP_RANGE = (0.0, 100.0)   # pF
OUT_LOW_REQ = -6.0
WIDTH_TOL_H = 1.5          # |measured-start| <= tol passes (high_pulse width)


def _num(v, default=None):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if not np.isfinite(f):
        return None
    return f


def _wl(v, default, lo, hi, tag, errors):
    """Accept 8, '8u', '8.0u'. Returns (text, ok)."""
    if v is None:
        v = default
    if isinstance(v, str):
        s = v.strip()
        if SHELL_RE.search(s):
            errors.append(f"{tag} {v!r}: illegal characters")
            return None
        m = re.fullmatch(r"([0-9]*\.?[0-9]+)\s*u?", s)
        if not m:
            errors.append(f"{tag} {v!r}: must be a number (um), e.g. 8 or '8u'")
            return None
        f = float(m.group(1))
    else:
        f = _num(v)
        if f is None:
            errors.append(f"{tag} {v!r}: must be a number (um)")
            return None
    if not (lo <= f <= hi):
        errors.append(f"{tag} {f} um out of range {lo}..{hi}")
        return None
    return f"{f:g}u"


def _get(desc, *keys, default=None):
    for k in keys:
        if k in desc:
            return desc[k]
    return default


# ================= DRIVER =================
def validate_driver(desc):
    errors, warnings, suggestions = [], [], []
    if not isinstance(desc, dict):
        return ["top-level JSON must be an object"], [], [], {}
    preset = _get(desc, "preset", default="GW")
    if not isinstance(preset, str) or SHELL_RE.search(preset):
        errors.append(f"preset {preset!r} invalid")
        preset = "GW"
    preset = preset.upper() if isinstance(preset, str) else "GW"
    if preset not in DRIVER_DEFAULTS:
        warnings.append(f"unknown preset {preset!r}, treating as custom")
        preset = "GW"
    dflt = DRIVER_DEFAULTS[preset]

    vgh = _num(_get(desc, "VGH", "vgh", default=8.0))
    vgl = _num(_get(desc, "VGL", "vgl", default=-9.5))
    if vgh is None or vgl is None:
        return ["VGH and VGL must be numbers"], [], [], {}
    if not (VGH_RANGE[0] <= vgh <= VGH_RANGE[1]):
        errors.append(f"VGH {vgh} V out of range {VGH_RANGE[0]}..{VGH_RANGE[1]} V")
    if not (VGL_RANGE[0] <= vgl <= VGL_RANGE[1]):
        errors.append(f"VGL {vgl} V out of range {VGL_RANGE[0]}..{VGL_RANGE[1]} V")
    if vgh <= 0 or vgl >= 0:
        errors.append("rails must satisfy VGH > 0 > VGL")
    freq = _num(_get(desc, "freq_kHz", "freq", default=250.0))
    if freq is None:
        errors.append("freq_kHz must be a number"); freq = 250.0
    if not (FREQ_RANGE[0] <= freq <= FREQ_RANGE[1]):
        errors.append(f"freq {freq} kHz out of range {FREQ_RANGE[0]}..{FREQ_RANGE[1]} kHz")
    try:
        n = int(_get(desc, "stages", default=6))
    except (TypeError, ValueError):
        errors.append("stages must be an integer"); n = 6
    if not (N_RANGE[0] <= n <= N_RANGE[1]):
        errors.append(f"stages {n} out of range {N_RANGE[0]}..{N_RANGE[1]}")
    try:
        frames = int(_get(desc, "frames", default=2))
    except (TypeError, ValueError):
        errors.append("frames must be an integer"); frames = 2
    if frames not in (1, 2, 3):
        errors.append("frames must be 1, 2 or 3")
    clock_mode = _get(desc, "clock_mode", default="continuous")
    if clock_mode not in ("continuous", "burst"):
        errors.append("clock_mode must be 'continuous' or 'burst'")
    polarity = _get(desc, "polarity", default=dflt["polarity"])
    if polarity not in ("low_pulse", "high_pulse"):
        errors.append("polarity must be 'low_pulse' or 'high_pulse'")
    start_w = _num(_get(desc, "start_width_H", default=dflt["start_width_H"]))
    if start_w is None or not (0.5 <= start_w <= 16):
        errors.append(f"start_width_H {start_w!r}: must be 0.5..16")
    margin = _num(_get(desc, "margin_V", default=1.5))
    if margin is None or not (0.2 <= margin <= 4):
        errors.append(f"margin_V {margin!r}: must be 0.2..4 V")
    rest_spec = _num(_get(desc, "rest_spec_V", "spec_low_V",
                           default=min(OUT_LOW_REQ, vgl + 2.0 if vgl else OUT_LOW_REQ)))
    if rest_spec is None:
        errors.append("rest_spec_V must be a number")
    width_tol = _num(_get(desc, "width_tol_H", default=WIDTH_TOL_H))
    if width_tol is None or not (0.25 <= width_tol <= 4):
        errors.append(f"width_tol_H {width_tol!r}: must be 0.25..4")

    tft_in = _get(desc, "tft")
    if tft_in is None:
        tft_in = dflt["tft"]
    if not isinstance(tft_in, dict) or not tft_in:
        errors.append("tft must be a non-empty object mapping T1..T12 to {G,S,D[,W,L,type]}")
        return errors, warnings, suggestions, {}
    tft = {}
    for name, pins in tft_in.items():
        if not isinstance(name, str) or SHELL_RE.search(name) or name not in D_T:
            errors.append(f"unknown TFT {name!r} (allowed T1..T12)")
            continue
        if not isinstance(pins, dict) or not PINS.issubset(set(pins.keys())):
            errors.append(f"{name} must have at least G/S/D pins")
            continue
        for pin in PINS:
            net = pins[pin]
            if not isinstance(net, str) or SHELL_RE.search(net) or net not in D_VALID:
                errors.append(f"{name}.{pin} net {net!r} invalid "
                              f"(allowed: {sorted(D_VALID)})")
        w = _wl(pins.get("W"), 4.0, *W_RANGE, f"{name}.W", errors)
        l = _wl(pins.get("L"), 4.5, *L_RANGE, f"{name}.L", errors)
        typ = pins.get("type", pins.get("pol", "P"))
        if typ not in ("P", "N", 1, -1):
            errors.append(f"{name}.type {typ!r}: must be 'P' or 'N'")
            typ = "P"
        pol = 1 if typ in ("P", 1) else -1
        vt0 = _num(pins.get("VT0", 1.1))
        if vt0 is None or not (0.2 <= vt0 <= 5):
            errors.append(f"{name}.VT0 {pins.get('VT0')!r}: must be 0.2..5")
            vt0 = 1.1
        if w and l:
            tft[name] = {"G": pins["G"], "S": pins["S"], "D": pins["D"],
                         "W": w, "L": l, "POL": pol, "VT0": vt0}
    caps_in = _get(desc, "caps")
    if caps_in is None:
        caps_in = dflt["caps"]
    caps = []
    if not isinstance(caps_in, list) or len(caps_in) > 12:
        errors.append("caps must be a list of at most 12 {a,b,pf}")
    else:
        for i, c in enumerate(caps_in):
            if not isinstance(c, dict):
                errors.append(f"caps[{i}] must be an object"); continue
            a, b = c.get("a"), c.get("b")
            for tag, net in (("a", a), ("b", b)):
                if not isinstance(net, str) or SHELL_RE.search(net) or net not in D_VALID | {"0"}:
                    errors.append(f"caps[{i}].{tag} net {net!r} invalid")
            pf = _num(c.get("pf"))
            if pf is None or not (CAP_RANGE[0] <= pf <= CAP_RANGE[1]):
                errors.append(f"caps[{i}].pf {c.get('pf')!r}: must be "
                              f"{CAP_RANGE[0]}..{CAP_RANGE[1]} pF")
                continue
            nm = c.get("name", f"C{i+1}")
            if not isinstance(nm, str) or not NAME_RE.fullmatch(nm):
                errors.append(f"caps[{i}].name {nm!r} invalid"); continue
            if isinstance(a, str) and isinstance(b, str) and a in D_VALID | {"0"} and b in D_VALID | {"0"}:
                caps.append({"a": a, "b": b, "pf": pf, "name": nm})
    cl = _num(_get(desc, "cload_pf", default=1.0))
    if cl is None or not (0 <= cl <= 100):
        errors.append(f"cload_pf {cl!r}: must be 0..100 pF")

    if errors:
        return errors, warnings, suggestions, {}
    H = 1000.0 / freq
    norm = {"kind": "driver", "preset": preset, "VGH": vgh, "VGL": vgl,
            "freq_kHz": freq, "stages": n, "frames": frames,
            "clock_mode": clock_mode, "polarity": polarity,
            "start_width_H": start_w, "margin_V": margin,
            "rest_spec_V": rest_spec, "width_tol_H": width_tol,
            "H": H, "tft": tft, "caps": caps, "cload_pf": cl}
    return errors, warnings, suggestions, norm


PWFRAC = 0.75


def build_driver_cir(norm, jobdir):
    VGH, VGL, H, N = norm["VGH"], norm["VGL"], norm["H"], norm["stages"]
    P, PW = 2 * H, H * PWFRAC
    TR = round(P * 0.00625, 4)
    frames, W = norm["frames"], norm["start_width_H"]
    # Frame grid: every frame start on a whole clock period (spec: frame
    # period must be a whole number of clock periods).
    import math
    K = math.ceil((N + W) / 2) + 8
    F = P * K
    SETTLE = 4 * P
    T0 = SETTLE + P
    T0s = [T0 + f * F for f in range(frames)]
    TEND = T0 + frames * F

    def pwl_pts(segs, rest):
        # segs: [(t_start, t_end, level)] -> PWL string
        pts = [(0.0, rest)]
        for (a, b, v) in segs:
            if b <= 0 or a >= TEND:
                continue
            a = max(a, 0.0)
            pts += [(a, rest), (a + TR, v), (b, v), (b + TR, rest)]
        pts.sort()
        return " ".join(f"{a:.4f}u {b}" for a, b in pts)

    # clocks
    def clk_segs(off):
        segs = []
        t = T0 - SETTLE + off
        # align first low at/after grid start
        while t + PW < T0 - SETTLE + off + P:
            t += P
        t = T0 - 4 * P + off
        while t < TEND:
            if norm["clock_mode"] == "burst":
                in_scan = any((T0f - 2 * P) <= t <= (T0f + (N - 1) * H + W * H + P)
                              for T0f in T0s)
                if not in_scan:
                    t += P
                    continue
            if t + PW < TEND + P:
                segs.append((t, t + PW, VGL))
            t += P
        return segs

    c1 = pwl_pts(clk_segs(0), VGH)
    c2 = pwl_pts(clk_segs(P / 2), VGH)

    # start signal
    if norm["polarity"] == "low_pulse":
        segs = [(T0f - 0.5, T0f + PW + 0.5, VGL) for T0f in T0s]
        flm = pwl_pts(segs, VGH)
    else:
        segs = [(T0f - H / 2, T0f - H / 2 + W * H, VGH) for T0f in T0s]
        flm = pwl_pts(segs, VGL)

    tft = norm["tft"]

    def pin(net):
        if net == "FLM":
            return "IN"
        return {"CLK1": "CKA", "CLK2": "CKB"}.get(net, net)

    L = [f"* gw-react driver job preset={norm['preset']} H={H:.3f}us "
         f"f={norm['freq_kHz']}kHz VGH={VGH} VGL={VGL} mode={norm['clock_mode']} "
         f"pol={norm['polarity']} W={W}H"]
    for name in sorted(tft, key=lambda t: int(t[1:])):
        p = tft[name]
        L.append(f".model m{name} ptft_fit W={p['W']} L={p['L']} "
                 f"VT0={p['VT0']:.3f} U0=65.00 POL={p['POL']}")
    L.append(".subckt gstage IN CKA CKB OUT VGH VGL")
    for name in sorted(tft, key=lambda t: int(t[1:])):
        p = tft[name]
        L.append(f"N_{name} {pin(p['D'])} {pin(p['G'])} {pin(p['S'])} m{name}")
    for c in norm["caps"]:
        L.append(f"{c['name']} {pin(c['a'])} {pin(c['b'])} {c['pf']}p")
    if norm["cload_pf"]:
        L.append(f"CL OUT 0 {norm['cload_pf']}p")
    L.append(".ends")
    L += [f"VGH VGH 0 {VGH}", f"VGL VGL 0 {VGL}",
          f"VFLM FLM 0 PWL({flm})",
          f"VCLK1 CLK1 0 PWL({c1})", f"VCLK2 CLK2 0 PWL({c2})"]
    prev = "FLM"
    for i in range(1, N + 1):
        ck = ("CLK1", "CLK2") if i % 2 else ("CLK2", "CLK1")
        L.append(f"X{i} {prev} {ck[0]} {ck[1]} OUT{i} VGH VGL gstage")
        prev = f"OUT{i}"
    outs = " ".join(f"v(OUT{i})" for i in range(1, N + 1))
    inn = sorted({p["G"] for p in tft.values()} | {p["S"] for p in tft.values()} |
                 {p["D"] for p in tft.values()} | {c["a"] for c in norm["caps"]} |
                 {c["b"] for c in norm["caps"]})
    inn = [n for n in inn if n not in ("VGH", "VGL", "FLM", "CLK1", "CLK2", "OUT", "IN", "0")]
    nodes = " ".join(f"v(x1.{n.lower()})" for n in inn)
    L += [".options method=gear reltol=1e-4 abstol=1e-12 vntol=1e-6 gmin=1e-12",
          ".control", "pre_osdi ptft_fit.osdi", f"tran 10n {TEND:.3f}u 0 20n",
          "set wr_singlescale", "set wr_vecnames",
          f"wrdata out.txt v(FLM) v(CLK1) v(CLK2) {outs} {nodes}", ".endc", ".end"]
    cir = os.path.join(jobdir, "job.cir")
    open(cir, "w").write("\n".join(L) + "\n")
    info = {"H": H, "P": P, "PW": PW, "T0": T0, "T0s": T0s, "TEND": TEND,
            "frames": frames, "frame_period": F, "start_width_us": W * H,
            "internals": [n.lower() for n in inn]}
    return cir, info


def driver_passfail(arr, header, norm, info):
    """Per stage per frame: exactly one ordered pulse + level/width checks."""
    t = arr[:, 0] * 1e6
    idx = {name: i for i, name in enumerate(header)}
    H, T0s = info["H"], info["T0s"]
    W = norm["start_width_H"]
    vgh, vgl = norm["VGH"], norm["VGL"]
    thr = (vgh + vgl) / 2
    res = {"stages": {}, "order_ok": True, "pass": True, "reasons": []}

    def pulses_in_window(o, t, a, b, high):
        m = (t >= a) & (t <= b)
        tt, oo = t[m], o[m]
        if len(tt) == 0:
            return []
        act = oo > thr if high else oo < thr
        out, i = [], 0
        while i < len(tt):
            if not act[i]:
                i += 1
                continue
            j = i
            while j + 1 < len(tt) and act[j + 1]:
                j += 1
            seg = oo[i:j + 1]
            out.append({"t_start": float(tt[i]), "t_end": float(tt[j]),
                        "extreme": float(seg.max() if high else seg.min())})
            i = j + 1
        return out

    prev_start = {}
    for f, T0f in enumerate(T0s):
        for i in range(1, norm["stages"] + 1):
            key = f"OUT{i}"
            o = arr[:, idx[f"v({key})"]]
            exp = T0f + (i - 1) * H
            a, b = exp - H, exp + W * H + 3 * H
            high = norm["polarity"] == "high_pulse"
            pp = pulses_in_window(o, t, a, b, high)
            st = {"pulses": len(pp), "pass": True, "reasons": []}
            if len(pp) != 1:
                st["pass"] = False
                st["reasons"].append(
                    f"frame{f+1} {key}: {len(pp)} active pulses in window "
                    f"(expected exactly 1)")
            if pp:
                p = max(pp, key=lambda q: (q["t_end"] - q["t_start"]))
                st["t_start"] = round(p["t_start"], 3)
                st["width_us"] = round(p["t_end"] - p["t_start"], 3)
                st["width_H"] = round((p["t_end"] - p["t_start"]) / H, 2)
                st["extreme"] = round(p["extreme"], 3)
                if high:
                    if p["extreme"] < vgh - norm["margin_V"]:
                        st["pass"] = False
                        st["reasons"].append(
                            f"frame{f+1} {key}: high {p['extreme']:.2f}V < "
                            f"VGH-margin {vgh - norm['margin_V']:.2f}V")
                    if abs((p["t_end"] - p["t_start"]) / H - W) > norm["width_tol_H"]:
                        st["pass"] = False
                        st["reasons"].append(
                            f"frame{f+1} {key}: width "
                            f"{(p['t_end'] - p['t_start']) / H:.2f}H vs start "
                            f"{W}H (tol {norm['width_tol_H']}H)")
                else:
                    if p["extreme"] > norm["rest_spec_V"]:
                        st["pass"] = False
                        st["reasons"].append(
                            f"frame{f+1} {key}: low {p['extreme']:.2f}V > "
                            f"spec {norm['rest_spec_V']}V")
                # rest-level check outside the pulse within the frame
                f_end = T0f + info["frame_period"]
                m = (t >= T0f - H) & (t <= f_end)
                tt, oo = t[m], o[m]
                keep = np.ones(len(oo), bool)
                for q in pp:
                    keep[(tt >= q["t_start"] - H) & (tt <= q["t_end"] + H)] = False
                if high:
                    if keep.any() and oo[keep].max() > norm["rest_spec_V"]:
                        st["pass"] = False
                        st["reasons"].append(
                            f"frame{f+1} {key}: rest {oo[keep].max():.2f}V > "
                            f"rest spec {norm['rest_spec_V']}V")
                else:
                    if keep.any() and oo[keep].min() < vgh - norm["margin_V"]:
                        st["pass"] = False
                        st["reasons"].append(
                            f"frame{f+1} {key}: rest dips to "
                            f"{oo[keep].min():.2f}V < VGH-margin "
                            f"{vgh - norm['margin_V']:.2f}V")
            else:
                st["pass"] = False
                st["reasons"].append(f"frame{f+1} {key}: no active pulse found")
            # stage order: pulse start must follow previous stage
            if pp and f in prev_start and i > 1:
                if min(q["t_start"] for q in pp) <= prev_start[f]:
                    st["pass"] = False
                    st["reasons"].append(
                        f"frame{f+1} {key}: pulse not after stage {i-1} (order)")
            if pp:
                prev_start[f] = max(q["t_start"] for q in pp)
            res["stages"][f"f{f+1}.{key}"] = st
            if not st["pass"]:
                res["pass"] = False
                res["reasons"].extend(st["reasons"])
    if not res["reasons"]:
        res["reasons"] = ["all stages: exactly one ordered pulse, levels OK"]
    return res


def _run_ngspice(jobdir, cir):
    try:
        os.symlink(os.path.join(HERE, "ptft_fit.osdi"),
                   os.path.join(jobdir, "ptft_fit.osdi"))
    except FileExistsError:
        pass
    try:
        proc = subprocess.run(["ngspice", "-b", cir], capture_output=True,
                              text=True, timeout=300, cwd=jobdir,
                              env={k: v for k, v in os.environ.items()
                                   if "KEY" not in k.upper()})
    except (OSError, subprocess.SubprocessError) as exc:
        return None, f"ngspice launch failed: {type(exc).__name__}"
    open(os.path.join(jobdir, "ngspice.log"), "w").write(proc.stdout + proc.stderr)
    txt = os.path.join(jobdir, "out.txt")
    if not os.path.exists(txt):
        tail = "\n".join((proc.stdout + proc.stderr).splitlines()[-8:])
        return None, "no ngspice output: " + tail
    lines = open(txt).read().splitlines()
    header = lines[0].split()
    arr = np.array([[float(x) for x in ln.split()] for ln in lines[1:]])
    return (arr, header), ""


def run_driver(desc):
    errors, warnings, suggestions, norm = validate_driver(desc)
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings,
                "suggestions": suggestions}
    jid = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    jobdir = os.path.join(RUNS, jid)
    os.makedirs(jobdir)
    open(os.path.join(jobdir, "desc.json"), "w").write(
        json.dumps(desc, ensure_ascii=False, indent=1))
    cir, info = build_driver_cir(norm, jobdir)
    out, err = _run_ngspice(jobdir, cir)
    if out is None:
        return {"ok": False, "errors": [err], "warnings": warnings,
                "suggestions": suggestions, "job": jid}
    arr, header = out
    t = arr[:, 0] * 1e6
    idx = {name: i for i, name in enumerate(header)}
    summary = {}
    for i in range(1, norm["stages"] + 1):
        o = arr[:, idx[f"v(OUT{i})"]]
        summary[f"OUT{i}"] = {"min": round(float(o.min()), 3),
                              "max": round(float(o.max()), 3)}
    pf = driver_passfail(arr, header, norm, info)
    keep = np.linspace(0, len(t) - 1, min(len(t), 3000)).astype(int)
    series = {"t_us": [round(float(t[k]), 4) for k in keep]}
    for name in ["v(FLM)", "v(CLK1)", "v(CLK2)"] + \
            [f"v(OUT{i})" for i in range(1, norm["stages"] + 1)] + \
            [f"v(x1.{n})" for n in info["internals"]]:
        if name in idx:
            series[name] = [round(float(arr[k, idx[name]]), 4) for k in keep]
    return {"ok": True, "job": jid, "warnings": warnings,
            "suggestions": suggestions, "info": info, "summary": summary,
            "series": series, "passfail": pf,
            "rails": {"VGH": norm["VGH"], "VGL": norm["VGL"]},
            "timing": {"H_us": round(norm["H"], 4),
                       "freq_kHz": norm["freq_kHz"],
                       "polarity": norm["polarity"],
                       "clock_mode": norm["clock_mode"],
                       "start_width_H": norm["start_width_H"]},
            "cir": open(cir).read()}


# ================= PIXEL =================
P_RANGES = {"ELVDD": (3.0, 10.0), "ELVSS": (-3.0, 3.0),
            "VINT": (-6.0, 0.0), "VOBS": (0.0, 8.0), "DATA": (0.0, 8.0),
            "Cst_pf": (0.01, 10.0), "Coled_pf": (0.05, 20.0),
            "VT0_P": (0.2, 5.0), "VT0_N": (0.2, 5.0)}
P_SIGS = ("GI", "GC", "GW", "EM", "GO")
P_ACTIVE_HIGH = {"GI", "GC"}  # N TFTs; rest active-low (P TFTs)


def validate_pixel(desc):
    errors, warnings = [], []
    if not isinstance(desc, dict):
        return ["top-level JSON must be an object"], [], {}
    g = dict(PIXEL_DEFAULTS)
    for k in ("ELVDD", "ELVSS", "VINT", "VOBS", "DATA", "Cst_pf", "Coled_pf",
              "VT0_P", "VT0_N"):
        if k in desc:
            v = _num(desc[k])
            if v is None:
                errors.append(f"{k} must be a number")
            elif not (P_RANGES[k][0] <= v <= P_RANGES[k][1]):
                errors.append(f"{k} {v} out of range {P_RANGES[k]}")
            else:
                g[k] = v
    for k, rng in (("VGH", VGH_RANGE), ("VGL", VGL_RANGE)):
        v = _num(_get(desc, k, k.lower(), default=g.get(k, 8.0 if k == "VGH" else -9.5)))
        if v is None:
            errors.append(f"{k} must be a number"); continue
        if not (rng[0] <= v <= rng[1]):
            errors.append(f"{k} {v} out of range {rng}")
        g[k] = v
    hz = _num(_get(desc, "frame_hz", default=g["frame_hz"]))
    if hz is None or not (1 <= hz <= 1000):
        errors.append(f"frame_hz {hz!r}: must be 1..1000")
    else:
        g["frame_hz"] = hz
    frame_us = 1e6 / g.get("frame_hz", 120.0)
    timing = dict(g["timing"])
    if "timing" in desc:
        if not isinstance(desc["timing"], dict):
            errors.append("timing must be an object")
        else:
            for sig, win in desc["timing"].items():
                if sig not in P_SIGS:
                    errors.append(f"unknown timing signal {sig!r}")
                    continue
                if (not isinstance(win, (list, tuple)) or len(win) != 2):
                    errors.append(f"timing.{sig} must be [start_us, end_us]")
                    continue
                a, b = _num(win[0]), _num(win[1])
                if a is None or b is None or not (0 <= a < b <= frame_us):
                    errors.append(f"timing.{sig} [{win[0]!r},{win[1]!r}]: must satisfy "
                                  f"0<=start<end<={frame_us:.0f}us")
                    continue
                timing[sig] = [a, b]
    tft_in = desc.get("tft", PIXEL_TFT)
    if not isinstance(tft_in, dict) or not tft_in:
        errors.append("tft must be a non-empty object")
        return errors, warnings, {}
    tft = {}
    for name, pins in tft_in.items():
        if not isinstance(name, str) or SHELL_RE.search(name) or name not in P_T:
            errors.append(f"unknown TFT {name!r} (allowed T1..T8)")
            continue
        if not isinstance(pins, dict) or not PINS.issubset(set(pins.keys())):
            errors.append(f"{name} must have at least G/S/D pins")
            continue
        for pin in PINS:
            net = pins[pin]
            if not isinstance(net, str) or SHELL_RE.search(net) or net not in P_NETS:
                errors.append(f"{name}.{pin} net {net!r} invalid")
        w = _wl(pins.get("W"), 3.0, *W_RANGE, f"{name}.W", errors)
        l = _wl(pins.get("L"), 4.5, *L_RANGE, f"{name}.L", errors)
        typ = pins.get("type", "P")
        if typ not in ("P", "N"):
            errors.append(f"{name}.type {typ!r}: must be 'P' or 'N'")
            typ = "P"
        dv = _num(pins.get("dVth", 0.0))
        if dv is None or not (-2 <= dv <= 2):
            errors.append(f"{name}.dVth {pins.get('dVth')!r}: must be -2..2 V")
            dv = 0.0
        if w and l:
            tft[name] = {"type": typ, "G": pins["G"], "S": pins["S"],
                         "D": pins["D"], "W": w, "L": l, "dVth": dv}
    if errors:
        return errors, warnings, {}
    g["timing"], g["tft"], g["frame_us"] = timing, tft, frame_us
    return errors, warnings, g


def build_pixel_cir(g, jobdir):
    F = g["frame_us"]
    TEND = 2 * F
    TR = 0.1
    L = [f"* gw-react 8T1C pixel DATA={g['DATA']} frame={F:.0f}us"]
    for name in sorted(g["tft"], key=lambda t: int(t[1:])):
        p = g["tft"][name]
        vt0 = (g["VT0_P"] if p["type"] == "P" else g["VT0_N"]) + p["dVth"]
        pol = 1 if p["type"] == "P" else -1
        L.append(f".model m{name} ptft_fit W={p['W']} L={p['L']} "
                 f"VT0={vt0:.3f} U0=65.00 POL={pol}")
        L.append(f"N_{name} {p['D']} {p['G']} {p['S']} m{name}")
    L += [f"Cst NG ELVDD {g['Cst_pf']}p",
          f"Coled ANODE ELVSS {g['Coled_pf']}p",
          ".model oled D(IS=1e-15 N=1.2 RS=300K)",  # synthetic OLED: ~1-2V at uA
          "Doled ANODE N_OLED oled",
          "Vsense N_OLED ELVSS 0",
          f"VELVDD ELVDD 0 {g['ELVDD']}", f"VELVSS ELVSS 0 {g['ELVSS']}",
          f"VVINT VINT 0 {g['VINT']}", f"VVOBS VOBS 0 {g['VOBS']}",
          f"VDATA DATA 0 {g['DATA']}",
          f"VVGH VGH 0 {g['VGH']}", f"VVGL VGL 0 {g['VGL']}"]
    for sig in P_SIGS:
        a, b = g["timing"][sig]
        if sig in P_ACTIVE_HIGH:
            rest, act = g["VGL"], g["VGH"]
        else:
            rest, act = g["VGH"], g["VGL"]
        pts = [(0.0, rest)]
        for f0 in (0.0, F):
            pts += [(f0 + a, rest), (f0 + a + TR, act), (f0 + b, act),
                    (f0 + b + TR, rest)]
        s = " ".join(f"{x:.3f}u {y}" for x, y in pts)
        L.append(f"V{sig} {sig} 0 PWL({s})")
    L += [".options method=gear reltol=1e-4 abstol=1e-13 vntol=1e-6 gmin=1e-12",
          ".control", "pre_osdi ptft_fit.osdi",
          f"tran 50n {TEND:.2f}u 0 1u",
          "set wr_singlescale", "set wr_vecnames",
          "wrdata out.txt v(GI) v(GC) v(GW) v(EM) v(GO) v(NG) v(NS) v(ND) "
          "v(ANODE) v(DATA) i(Vsense)", ".endc", ".end"]
    cir = os.path.join(jobdir, "job.cir")
    open(cir, "w").write("\n".join(L) + "\n")
    return cir, {"frame_us": F, "TEND": TEND, "timing": g["timing"]}


def run_pixel(desc):
    errors, warnings, g = validate_pixel(desc)
    if errors:
        return {"ok": False, "errors": errors, "warnings": warnings,
                "suggestions": []}
    jid = time.strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:6]
    jobdir = os.path.join(RUNS, jid)
    os.makedirs(jobdir)
    open(os.path.join(jobdir, "desc.json"), "w").write(
        json.dumps(desc, ensure_ascii=False, indent=1))
    cir, info = build_pixel_cir(g, jobdir)
    out, err = _run_ngspice(jobdir, cir)
    if out is None:
        return {"ok": False, "errors": [err], "warnings": warnings,
                "suggestions": [], "job": jid}
    arr, header = out
    t = arr[:, 0] * 1e6
    idx = {name: i for i, name in enumerate(header)}
    idx.update({k.lower(): v for k, v in idx.items()})  # i(Vsense) keeps case
    F = info["frame_us"]
    em0, em1 = info["timing"]["EM"]
    # frame-2 emission window, skip first 15% (settling)
    a, b = F + em0 + 0.15 * (em1 - em0), F + em1
    m = (t >= a) & (t <= b)
    ioled = arr[:, idx["i(vsense)"]]  # Vsense N_OLED->ELVSS: +i = OLED current
    i_em = float(ioled[m].mean()) if m.any() else 0.0
    m2 = (t >= F) & (t <= 2 * F)
    i_avg = float(ioled[m2].mean()) if m2.any() else 0.0
    ng = arr[:, idx["v(ng)"]]
    gc_end = F + info["timing"]["GC"][1]
    k = int(np.argmin(np.abs(t - (gc_end + 1.0))))
    ng_after_gc = float(ng[k])
    keep = np.linspace(0, len(t) - 1, min(len(t), 3000)).astype(int)
    series = {"t_us": [round(float(t[k]), 3) for k in keep]}
    for name in ["v(gi)", "v(gc)", "v(gw)", "v(em)", "v(go)", "v(ng)",
                 "v(ns)", "v(nd)", "v(anode)"]:
        if name in idx:
            series[name] = [round(float(arr[k, idx[name]]), 4) for k in keep]
    if "i(vsense)" in idx:
        series["i(oled)"] = [round(float(arr[k, idx["i(vsense)"]]) * 1e6, 4)
                             for k in keep]  # uA
    return {"ok": True, "job": jid, "warnings": warnings, "info": info,
            "result": {"i_emission_uA": round(i_em * 1e6, 4),
                       "i_frame_avg_uA": round(i_avg * 1e6, 4),
                       "ng_after_gc_V": round(ng_after_gc, 4),
                       "data_V": g["DATA"]},
            "series": series, "cir": open(cir).read()}


def run_job(desc):
    if isinstance(desc, dict) and desc.get("kind") == "pixel":
        return run_pixel(desc)
    # accept legacy gw_lab descs (vgh/res/freq keys, T1..T9 only)
    if isinstance(desc, dict):
        d = dict(desc)
        if "vgh" in d and "VGH" not in d:
            d["VGH"] = d.pop("vgh")
        if "vgl" in d and "VGL" not in d:
            d["VGL"] = d.pop("vgl")
        if "freq" in d and "freq_kHz" not in d:
            d["freq_kHz"] = d.pop("freq")
        if "res" in d and "resolution" not in d:
            d["resolution"] = d.pop("res")
        return run_driver(d)
    return run_driver(desc)


if __name__ == "__main__":
    import sys
    print(json.dumps(run_job(json.load(sys.stdin)), ensure_ascii=False))
