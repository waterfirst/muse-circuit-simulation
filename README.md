# Muse Circuit Simulation

React + Vite front end and local `ngspice` backend for the GW netlist lab.
It simulates LTPS/oxide TFT driver and pixel circuits with the bundled
`ptft_fit.osdi` compact model.

## Choose an execution mode

| Goal | What is required | What works |
| --- | --- | --- |
| Browse the lab and its verified example waveforms | Node.js only | The UI and bundled demo data |
| Run a new circuit simulation | Linux x86_64, Python, an **OSDI-enabled** ngspice build | The complete local simulator |
| Modify `models/ptft_fit.va` | The complete local simulator plus OpenVAF | Rebuild `server/ptft_fit.osdi` |

> **Important:** The web UI can open without the backend. In that mode it
> displays bundled, verified demo series; it does not calculate a new circuit.

## 1. Quick UI / demo start

This is the recommended path for a presentation or a first look. Node.js
**20.19+ or 22.12+** is required by Vite 8.

```bash
git clone https://github.com/waterfirst/muse-circuit-simulation.git
cd muse-circuit-simulation
node --version
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173/`). Stop the
server with `Ctrl+C`.

Run the frontend checks before a presentation:

```bash
npm test
npm run build
```

If Node.js is missing or older than the required version, install a current
Node.js LTS release first. Do not rely on an old distribution `nodejs` package.

## 2. Full local simulation on Ubuntu / Linux x86_64

The checked-in `server/ptft_fit.osdi` is a prebuilt **x86_64 Linux** model.
It needs an ngspice executable compiled with the OSDI interface. A plain
`apt install ngspice` package may not include that interface, so always run the
verification in step 4.

### 2.1 Install base tools

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential \
  python3 python3-venv python3-pip
```

Install a current Node.js LTS release separately, then check it:

```bash
node --version
npm --version
```

### 2.2 Create an isolated Python environment

From the repository root:

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r server/requirements.txt
```

Every new terminal that runs the backend must activate the environment again:

```bash
cd /path/to/muse-circuit-simulation
. .venv/bin/activate
```

### 2.3 Install ngspice with OSDI support

The backend loads the model with the netlist command `pre_osdi`. That command
requires ngspice 39 or newer **built with `--enable-osdi`**. The recommended
route is an official ngspice development build that explicitly lists
OpenVAF/OSDI support. If building from source, configure with at least:

```bash
./configure --enable-osdi --enable-predictor --enable-xspice --with-readline=yes
make -j"$(nproc)"
sudo make install
```

If `ngspice` is not on `PATH`, point the backend at it instead of editing the
source code:

```bash
export NGSPICE_BIN=/absolute/path/to/ngspice
```

Official references: [ngspice OSDI build notes](https://github.com/imr/ngspice/blob/master/README_OSDI.md)
and [ngspice downloads](https://ngspice.sourceforge.io/download.html).

### 2.4 Verify the real model before starting the web server

This command runs a bundled one-device probe. It verifies both ngspice and the
bundled `ptft_fit.osdi` model; success ends with `No. of Data Rows` and exit
code `0`.

```bash
cd server/runs/probe_p
ngspice -b iv_p.cir
cd ../../..
```

If you see `unknown command pre_osdi`, your ngspice build has no OSDI support.
Install or build an OSDI-enabled version; installing Python packages will not
fix that error.

### 2.5 Start backend and frontend

Terminal 1 — backend (intentionally bound to localhost only):

```bash
cd /path/to/muse-circuit-simulation
. .venv/bin/activate
python3 server/app.py
```

Verify it in a second terminal:

```bash
curl http://127.0.0.1:8768/health
# expected: {"status": "ok"}
```

Terminal 2 — frontend:

```bash
cd /path/to/muse-circuit-simulation
npm ci
npm run dev
```

Open the Vite URL. The frontend first tries its same-origin API and then falls
back to `http://127.0.0.1:8768`, so both processes must run on the same
computer for local development.

### 2.6 Run backend tests (optional, slow)

```bash
cd /path/to/muse-circuit-simulation
. .venv/bin/activate
python3 -m pytest server/tests/ -q
```

The complete backend suite invokes ngspice repeatedly and can take several
minutes. It is a verification step, not required to open the UI.

## 3. OpenVAF: only for rebuilding the device model

OpenVAF is **not required** to run the committed `server/ptft_fit.osdi` model.
Install it only when changing `models/ptft_fit.va`.

1. Download the Linux OpenVAF executable from the
   [official installation page](https://openvaf.github.io/docs/getting-started/installation/).
2. Put the executable on `PATH`, for example:

   ```bash
   mkdir -p ~/.local/bin
   install -m 0755 ~/Downloads/openvaf ~/.local/bin/openvaf
   export PATH="$HOME/.local/bin:$PATH"
   openvaf --help
   ```

3. Rebuild and re-run the OSDI probe:

   ```bash
   scripts/build_model.sh
   cd server/runs/probe_p && ngspice -b iv_p.cir
   ```

Commit a rebuilt `.osdi` only after the probe and test suite pass. The runtime
ngspice build and the generated model must use compatible OSDI support.

## Security and deployment notes

- `server/app.py` listens on `127.0.0.1:8768` by default. Keep it localhost
  only for personal use.
- Do not expose the backend directly to the public internet. A public website
  should use a reverse proxy with authentication, rate limits, request limits,
  and a worker/container boundary for ngspice jobs.
- The backend serializes simulations, but a single job may still take minutes.
  Do not run it as an unrestricted public API.
- For a static deployment, build with the intended Vite base path. See
  [`docs/DEPLOY_CIRCUIT2.md`](docs/DEPLOY_CIRCUIT2.md) for the current
  waterfirst.pro deployment layout.

## Project layout

```text
src/                    React application
server/app.py           localhost HTTP API
server/backend.py       validation, deck generation, ngspice invocation
server/ptft_fit.osdi    bundled x86_64 Linux compact model
models/ptft_fit.va      Verilog-A source model
scripts/build_model.sh  rebuilds the OSDI model with OpenVAF
server/runs/            saved deck/description examples and generated jobs
```
