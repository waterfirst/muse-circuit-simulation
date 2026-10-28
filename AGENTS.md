# AGENTS.md — gw-react display-circuit simulator

React + Vite UI (`base: "/circuit-muse/"`) + stdlib-only Python backend that
drives ngspice with the Verilog-A TFT model `ptft_fit` (OpenVAF-compiled OSDI).

## Setup (company machine with ngspice + OpenVAF already installed)

```bash
cd gw-react
python3 -m venv .venv && source .venv/bin/activate
pip install -r server/requirements.txt   # numpy (+pytest, harmless)
scripts/build_model.sh                   # compiles models/ptft_fit.va -> server/ptft_fit.osdi
scripts/self_check.sh                    # backend tests + npm test + build (needs npm for the last two;
                                         # without npm, run only: python3 -m unittest discover -s server/tests)
python3 server/app.py                    # backend on http://127.0.0.1:8768 (localhost only, no tunnels)
```

Serve the UI from the committed prebuilt `dist/` (npm optional):
copy `dist/` to the web server path for `/circuit-muse/`, or preview with
`npm run preview`. To rebuild: `npm install && npm run build`.

## Tool paths (environment variables)

| Var | Default | Meaning |
|---|---|---|
| `NGSPICE_BIN` | `ngspice` | ngspice binary |
| `OSDI_PATH` | `server/ptft_fit.osdi` | compiled model used by sims |
| `OPENVAF_BIN` | `openvaf` | used by `scripts/build_model.sh` |
| `OSDI_OUT` | `server/ptft_fit.osdi` | build output path |
| `OMP_THREAD_LIMIT` | `1` (set by backend) | ngspice-45.2 Ubuntu build spawns 8 wasteful OpenMP threads; cap to 1 (4x faster, see docs/BUILD_LOG.md) |

## Self-check

```bash
scripts/self_check.sh   # == backend unittest suite + npm test + npm run build
```

Expected: backend 21/21 pass, `npm test` 34/34 pass, build ok.
Full output of the last verified run: `docs/SELF_CHECK.txt`.

## Rules

- Public patents/literature only. Sizes, caps, timings, degradation and
  temperature coefficients are synthetic assumptions — see `docs/ASSUMPTIONS.md`.
- **Company netlists, device cards or measured data go into the untracked
  folder `private/` and are NEVER committed** (`private/` is in `.gitignore`).
- Backend binds `127.0.0.1:8768` only. Never start cloudflared/ngrok/Tailscale
  Funnel or any tunnel from this repo.
- Every reported number must come from a saved run under `server/runs/`
  (deck `job.cir` + `desc.json` + `ngspice.log` + `out.txt`); cite the folder.
- Do not modify `~/gw_lab/`; this repo is self-contained.
