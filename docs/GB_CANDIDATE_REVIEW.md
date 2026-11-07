# GB synthetic candidate: review and deployment notes

This addition is a separate, fixed-template experiment. It does not replace
the existing driver/pixel presets or reproduce the original GB topology.
Only T9 width and C3 value are editable; the page documents fixed conditions.

## Local use

Follow README's Linux x86_64 setup, Python environment and OSDI checks.
The new endpoint also supports an OSDI-enabled libngspice shared library;
legacy endpoints still require the ngspice executable.

In one terminal, from the repository root:

```sh
. .venv/bin/activate
python server/app.py
```

In another terminal:

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open http://127.0.0.1:5173/#/gb-candidate and select a T9/C3 combination.
The browser sends one request; a failed calculation never becomes a demo.
Do not expose the development servers publicly.

## Verification performed

- Frontend: 46 tests passed, TypeScript and production build passed.
- New backend: six tests passed, including allowed parameter bounds,
  rejection of unknown inputs, exact four-case deck differences, waveform
  completeness and min/max-preserving downsampling.
- New adapter: actual libngspice run at T9=112 um, C3=1 pF reached 400 us,
  with 29,786 raw points. Numerical completion does not mean circuit PASS.
- HTTP integration: a real T9=112 um / C3=1 pF POST returned 200,
  reached 400 us and its exact input-deck link returned 200. Invalid input
  returned 422 as intended.
- Full backend: 36 tests ran, 13 failed. The unchanged baseline reproduced
  exactly the same 13 failures in 30 tests: 12 require an ngspice executable
  missing from the test environment; one requires an external gw_lab model.
  This is not a full backend-suite pass.
- Browser visual / browser-to-backend end-to-end verification is incomplete.
  The local server answered HTTP, but the available browser could not
  connect. DOM component tests do not substitute for visual inspection.

## Deployment precautions

The reviewed source base is main commit
84c053fe6e1ae78f49cd68b29b3167be95e96302.
The currently served GB simulator and this repository's generic generator
have previously shown differences, including ESR and GB16 support. The
production checkout's exact version has not been confirmed. Do not overwrite
an existing production checkout blindly with this snapshot.

1. Identify and back up the actual deployed source and configuration.
2. Integrate the small new route/module/template and frontend tab into that
   source, preserving existing routes and deployment settings.
3. Run the normal tests with the production ngspice/OSDI environment and
   complete browser-to-backend testing in an isolated staging environment.
4. Deploy frontend and Python backend together, using the existing reverse
   proxy; verify /api/gb-candidate and the linked /runs/.../deck.cir path.
5. Check current run-retention settings and keep a rollback plan.

The existing main-push workflow publishes only static GitHub Pages assets.
It does not deploy Python or ngspice. A branch or draft PR is not a deployed
simulator. No production deployment or main merge is part of this change.

## Source-only review branch

This change publishes source and small reproduction inputs only. The tracked
prebuilt `dist/` remains unchanged and does not contain the new GB tab.
Run `npm ci && npm run build` to generate it locally. The existing Pages
workflow builds from source after a future authorized merge; this branch does
not merge, publish Pages, or update the production Python server.
