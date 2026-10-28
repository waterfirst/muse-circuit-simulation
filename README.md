# GW Lab React

React + Vite + TypeScript port of the GW netlist lab
(`waterfirst/muse-circuit-simulation`, vanilla `index.html` + `gw7t.html`).

## Run

```bash
cd gw-react
npm install
npm run dev      # http://localhost:5173/
npm test         # vitest: 29 tests
npm run build    # tsc + vite build -> dist/
```

## Deploy

Committed `dist/` uses `base: "/circuit-muse/"`. For
`https://waterfirst.pro/circuit2/` build with
`npx vite build --base=/circuit2/ --outDir <staging>/circuit2`
(see `docs/DEPLOY_CIRCUIT2.md` for the full runbook: static copy, backend
service, nginx `/circuit2/api/` proxy). Routes are hash-based
(`#/` lab, `#/gw7t` report) so no server rewrites are needed, but the page
must be served with a trailing slash (`/circuit2/` → static dir).

## Backend

`POST {base}/api/sim` with the desc JSON (`src/lib/api.ts` `BACKENDS`).
Without a reachable backend the lab shows the bundled verified demo series.

## Server setup (fresh machine with ngspice + openvaf)

```bash
python3 -m pip install -r server/requirements.txt
python3 server/app.py        # 127.0.0.1:8768, localhost only
python3 -m pytest server/tests/ -q   # 11 tests, needs ngspice (~8 min)
```

- Decks + descs live in `server/runs/<job>/` (`out.txt` traces regenerate on rerun).
- Device model `server/ptft_fit.osdi` (POL=1 p-LTPS, POL=-1 n-oxide),
  prebuilt x86_64 Linux (no `.va` in repo; runs as-is under ngspice).
- Frontend: `npm install`, `npm test` (34), `npm run build` (base `/circuit-muse/`).
