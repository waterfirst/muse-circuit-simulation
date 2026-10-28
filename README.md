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

`dist/` is built with `base: "/circuit/"` for `https://waterfirst.pro/circuit/`.
Copy `dist/*` to the `/circuit/` web root. Routes are hash-based
(`#/` lab, `#/gw7t` report) so no server rewrites are needed.

## Backend

`POST {base}/api/sim` with the desc JSON (`src/lib/api.ts` `BACKENDS`).
Without a reachable backend the lab shows the bundled verified demo series.
