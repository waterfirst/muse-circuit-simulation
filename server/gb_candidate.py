"""Isolated synthetic 16-TFT GB candidate; not the original GB circuit.

Only T9 width and C3 can change. All timing, model and topology assumptions
are frozen to the calibrated two-frame reference deck.
"""
from pathlib import Path
import ctypes as C
import ctypes.util
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import uuid

import numpy as np
import backend

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / 'gb_candidate_template.cir'
OSDI = HERE / 'ptft_fit.osdi'
WARNINGS = [
    'Synthetic GB candidate example, not a reconstruction or validation of the original GB circuit.',
    'Fixed substitute TFT model and timing; numerical completion is not a functional pass/fail verdict.',
    'T9 width and C3 apply identically to all six stages; all other conditions are fixed.',
]
NAMES = ['FLM', 'CLK1', 'CLK2', 'ESR'] + [f'OUT{i}' for i in range(1, 7)] + [
    f'x1.{n}' for n in ('a', 'b', 'c', 'n1', 'n2', 'n3', 'n4', 'n8', 'q', 'qb')]


def validate_parameters(desc):
    if not isinstance(desc, dict):
        raise ValueError('Parameters must be a JSON object')
    unknown = set(desc) - {'t9_width_um', 'c3_pf'}
    if unknown:
        raise ValueError('Unknown parameters: ' + ', '.join(sorted(map(str, unknown))))
    result = {}
    for name, default, lo, hi in [('t9_width_um', 112, 4, 512), ('c3_pf', 1, .05, 5)]:
        value = desc.get(name, default)
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f'{name} must be a JSON number')
        try:
            value = float(value)
        except (OverflowError, ValueError):
            raise ValueError(f'{name} must be finite') from None
        if not math.isfinite(value) or not lo <= value <= hi:
            raise ValueError(f'{name} must be between {lo} and {hi}')
        result[name] = value
    return result


def build_deck(desc):
    p = validate_parameters(desc)
    return TEMPLATE.read_text().replace('@T9_WIDTH@', f'{p["t9_width_um"]:.15g}').replace(
        '@C3@', f'{p["c3_pf"]:.15g}').replace('@OSDI_PATH@', str(OSDI))


def validate_wave(data):
    if data.ndim != 2 or data.shape[0] < 2 or data.shape[1] != len(NAMES) + 1:
        raise ValueError('Malformed waveform dimensions')
    if not np.isfinite(data).all() or not np.all(np.diff(data[:, 0]) > 0):
        raise ValueError('Waveform must be finite with strictly increasing time')
    if data[0, 0] < 0 or data[0, 0] > 1e-8 or not np.isclose(data[-1, 0], 400e-6, rtol=1e-9, atol=1e-13):
        raise ValueError('Incomplete transient: expected 0 to 400 us')
    return data


def parse_wave(path):
    with open(path) as stream:
        header = stream.readline().split()
    expected = ['time'] + [f'v({name})'.lower() for name in NAMES]
    if [x.lower() for x in header] != expected:
        raise ValueError('Unexpected waveform columns')
    return validate_wave(np.loadtxt(path, skiprows=1, ndmin=2))


def downsample(data, max_points=6000):
    """Common time axis retaining every signal's min and max per time bin."""
    if len(data) <= max_points:
        return data
    bins = max(1, (max_points - 2) // (2 * (data.shape[1] - 1)))
    selected = {0, len(data) - 1}
    for inds in np.array_split(np.arange(len(data)), bins):
        values = data[inds, 1:]
        selected.update(inds[np.argmin(values, axis=0)].tolist())
        selected.update(inds[np.argmax(values, axis=0)].tolist())
    return data[sorted(selected)]


def shared_run(deck):
    """Only invoked in a separate process; callbacks live for the whole run."""
    lib = C.CDLL(ctypes.util.find_library('ngspice') or 'libngspice.so.0')
    cbtype = C.CFUNCTYPE(C.c_int, C.c_char_p, C.c_int, C.c_void_p)
    exittype = C.CFUNCTYPE(C.c_int, C.c_int, C.c_bool, C.c_bool, C.c_int, C.c_void_p)
    exits = []
    def sendchar(s, ident, userdata):
        print(s.decode(errors='replace'), flush=True)
        return 0
    def controlled(status, immediate, quitexit, ident, userdata):
        exits.append(status)
        return 0
    cb, exitcb = cbtype(sendchar), exittype(controlled)
    lib.ngSpice_Init(cb, None, exitcb, None, None, None, None)
    lib.ngSpice_Command.argtypes = [C.c_char_p]
    status = lib.ngSpice_Command(('source ' + str(Path(deck).resolve())).encode())
    if status or any(exits):
        raise RuntimeError(f'ngspice status={status}, exits={exits}')


def run_candidate(desc):
    try:
        parameters = validate_parameters(desc)
    except ValueError as exc:
        return {'ok': False, 'errors': [str(exc)], 'warnings': WARNINGS}
    job = str(uuid.uuid4())
    directory = Path(backend.RUNS) / job
    directory.mkdir(parents=True)
    deck = directory / 'deck.cir'
    deck.write_text(build_deck(parameters))
    metadata = {'candidate': 'synthetic_gb_16tft_calibrated_two_frames',
                'parameters': parameters, 'warnings': WARNINGS, 'completed': False,
                'deck_sha256': hashlib.sha256(deck.read_bytes()).hexdigest(),
                'stop_time_us': 400, 'timeout_s': 180}
    response = {'ok': False, 'job': job, 'parameters': parameters,
                'deck_url': f'/runs/{job}/deck.cir', 'warnings': WARNINGS}
    logpath = directory / 'ngspice.log'
    logpath.write_text('')
    try:
        if not OSDI.is_file():
            raise ValueError('Missing server/ptft_fit.osdi model; no simulation performed')
        metadata['osdi_sha256'] = hashlib.sha256(OSDI.read_bytes()).hexdigest()
        cli = shutil.which(backend.NGSPICE_BIN)
        cmd = [cli, '-b', str(deck.resolve())] if cli else [
            sys.executable, str(Path(__file__).resolve()), '--shared', str(deck.resolve())]
        metadata['engine'] = 'ngspice_cli' if cli else 'libngspice_subprocess'
        # Caller owns backend.SIM_LOCK, exactly as for the other backend runners.
        with logpath.open('w') as log:
            result = subprocess.run(cmd, cwd=directory, stdout=log, stderr=subprocess.STDOUT, timeout=180)
        log = logpath.read_text(errors='replace')
        if result.returncode or re.search(r'timestep too small|simulation interrupted|fatal error', log, re.I):
            raise ValueError('Simulator failed; see saved ngspice.log')
        values = parse_wave(directory / 'out.txt')
        reduced = downsample(values)
        response.update(ok=True, series={'time_us': (reduced[:, 0] * 1e6).tolist(),
                        'outputs': {name: reduced[:, i + 1].tolist() for i, name in enumerate(NAMES)}})
        metadata.update(completed=True, raw_points=len(values), returned_points=len(reduced))
    except (ValueError, OSError, subprocess.SubprocessError) as exc:
        response['errors'] = [str(exc)]
        metadata['error'] = str(exc)
    finally:
        (directory / 'metadata.json').write_text(json.dumps(metadata, indent=2, allow_nan=False))
    return response


if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] != '--shared':
        raise SystemExit('Usage: gb_candidate.py --shared deck.cir')
    shared_run(sys.argv[2])
