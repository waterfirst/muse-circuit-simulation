# Deploy: waterfirst.pro/circuit-muse/ — live sim demo

Goal: waterfirst.pro/circuit-muse/ serves the frontend AND proxies
/api/* to the sim backend. GitHub Pages stays static-only;
the live-sim link always points at waterfirst.pro.

Status: design doc only. No nginx edit, no service registration,
no commit/push/deploy done.

Local verification (2026-10-31, this machine): all 6 endpoints OK
on 127.0.0.1:8768 with ngspice-45.2 + OpenVAF-built ptft_fit.osdi.

API contract (server/app.py — do NOT drift without updating nginx):

- GET /health -> 200 {"status":"ok"}
- GET /api/presets -> 200 {GW:{polarity,start_width_H,tft,caps},
  EM:{...}, GC:{...}, GI:{...}, PIXEL:{defaults,tft}}
- POST /api/sim -> 200 or 422 {ok,job,errors,warnings,suggestions,
  summary,series:{t_us,...},info,passfail,cir}
  body: {circuit:"GW"|"EM"|"GC"|"GI", preset?, tft, caps,
  start_width_H, polarity, VGH?, VGL?, ...}
  max body 65536 bytes. Single global SIM_LOCK: concurrent POST
  returns 429 {ok:false, errors:["another simulation is running"]}.
- POST /api/pixel -> 200 or 422, same envelope + result:{i_emission_uA,
  i_frame_avg_uA,...}. body: pixel desc (kind:"pixel").
- POST /api/stress -> 200 or 422 {ok,kind:"driver"|"pixel",job,
  window_us,temp_C,hours,coefs,table:[{tft,duty_on,von_V,voff_V,
  vsd_V,dVth,ion,ioff,ss}]}. body: {desc,temp_C:-40..150,
  hours:0..100000,coefs?}.
- POST /api/margin -> 202 {ok:true,margin_job,total} or 422.
  body: {desc, vgh:[2..9 numbers], vgl:[2..9 numbers]},
  PUBLIC cap: vgh*vgl max 9 cells (3x3), total jobs = 2*cells
  (degraded+fresh), so max 18 sims per public request. Internal
  research cap stays 49 (direct start_margin call, local only).
  UI enforces the same 9-cell cap before POST.
- GET /api/margin?id=<margin_job> -> 200 {state:"running"|"done"|
  "error",done,total,kind,vgh,vgl,nominal,grids:{degraded,fresh},
  error,ref_i_uA} or 404 unknown margin job.
- GET /runs/<job>/<file> -> saved deck/log/trace (<20MB) or 404.

Verified live (127.0.0.1:8768):
- health -> {"status":"ok"}
- presets -> GW/EM/GC/GI + PIXEL keys present
- sim (GW default preset) -> ok:true, 1.2s
- pixel ({} defaults) -> ok:true
- stress (GW desc, 85C, 100h) -> ok:true, 9-row table
- margin (GW desc, vgh 2 x vgl 2) -> 202, polled to state:done 8/8

Toolchain on the NEW laptop (verified 2026-10-31):
- ngspice 45.2 at ~/.local/bin/ngspice (KLU solver build)
- openvaf at ~/.local/bin/openvaf
- server/ptft_fit.osdi present (35448 bytes)
- Tailscale IPv4: 100.69.9.76
- python3 has numpy/scipy; app.py needs stdlib only
  (backend.py imports numpy — confirm python3-numpy on new laptop)
- port 8768 free before/after test (test backend killed)

Frontend API routing (src/lib/api.ts — verified):
- BACKENDS = [sameOrigin, "http://127.0.0.1:8768"]
- sameOrigin derives from document.baseURI dir, so on
  waterfirst.pro/circuit-muse/ the FIRST try is
  https://waterfirst.pro/circuit-muse/api/*, fallback localhost.
- tryBackend/postPixel/postStress/postMargin/getMargin all loop
  BACKENDS the same way. post() treats 200 and 422 as answered.
- Consequence: nginx MUST proxy /circuit-muse/api/ so the
  same-origin first-try succeeds in production; otherwise the
  browser silently falls back to localhost:8768 and spins forever
  for public visitors.

Static bundle:
- vite base is "./" (relative), so the SAME dist/ works under
  /circuit-muse/ and on GitHub Pages. No --base rebuild needed.
- Deploy: copy dist/* to ~/web/circuit-muse/ on the OLD laptop.
- dist/index.html references ./assets/*, ./favicon.svg (verified).

Backend bind (NEW laptop, 100.69.9.76):
- app.py honors BIND_HOST (default 127.0.0.1). Public deploy:
  BIND_HOST=100.69.9.76 python3 server/app.py
- NEVER bind 0.0.0.0 or expose 8768 on a public IP. Accept traffic
  only from the Tailscale interface or via the old-laptop nginx.
- New-laptop firewall: allow 8768 from the OLD laptop's Tailscale IP
  only; deny the public interface.

nginx (OLD laptop) — for the user to apply, NOT applied yet.

Paste the limit_req_zone line in the http{} context (NOT inside
server{} — nginx -t fails there). Find the existing http block in
/etc/nginx/nginx.conf; the zone is declared once, shared by all
/…/api/ locations:

http {
  ...
  limit_req_zone $binary_remote_addr zone=sim:10m rate=5r/m;
  ...
}

server {
  ...
  location = /circuit-muse { return 301 /circuit-muse/; }
  location /circuit-muse/ {
    alias /home/USER/web/circuit-muse/;
    index index.html;
  }
  location /circuit-muse/api/ {
    limit_req zone=sim burst=2 nodelay;
    limit_req_status 429;
    client_max_body_size 128k;
    proxy_pass http://100.69.9.76:8768/api/;
    proxy_connect_timeout 10s;
    proxy_send_timeout 320s;
    proxy_read_timeout 330s;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Origin "";
  }
  ...
}

Trailing slashes on BOTH sides strip the /circuit-muse prefix so
/circuit-muse/api/sim reaches the backend as /api/sim. This matches
the app.py contract above (/api/sim, /api/pixel, /api/stress,
/api/margin, /api/presets, /api/margin?id=, /health stays local).

Timeout chain (must hold: ngspice < app < nginx):
- ngspice subprocess: 300s (backend.py, fixed).
- app wall-clock per sim/stress/pixel request: 320s default
  (SIM_TIMEOUT_S env), 504 on expiry, SIM_LOCK released.
- nginx proxy_send 320s / proxy_read 330s: strictly above app.
- margin POST returns 202 immediately; cells run in background
  (public max 9 cells x2 = 18 sims); poll GET /api/margin?id=.

Security posture (deployment-hardening branch, implemented):
- CORS: allowlist only — https://waterfirst.pro + localhost dev
  ports. Unknown Origin -> 403, no wildcard header. Same-origin
  (nginx proxy) and no-Origin (curl) requests pass.
- rate limit: 5 req/min per IP, burst 2, excess -> 429 (matches
  app's own 429 for concurrent sims).
- request size: nginx 128k, app hard cap 65536 bytes -> 413.
- runs retention: in-app prune — keep newest 200, max age 7d
  (RUNS_KEEP / RUNS_MAX_AGE_S env). Runs at startup + after each
  successful sim. Live jobs and tracked margin jobs never pruned.
- secrets: no keys, tokens, private paths, or company material in
  dist/, docs/, or nginx snippets. None are in this design.

systemd draft (NEW laptop, user unit
~/.config/systemd/user/circuit-muse.service):

[Unit]
Description=circuit-muse sim backend
After=network.target network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /home/USER/muse-circuit-simulation/server/app.py
Environment=BIND_HOST=100.69.9.76
Environment=OMP_THREAD_LIMIT=1
Environment=SIM_TIMEOUT_S=320
Environment=PUBLIC_MAX_CELLS=9
Environment=RUNS_KEEP=200
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=default.target

Enable-linger: user units stop at logout unless linger is on.
Run once: loginctl enable-linger waterfirst (needs sudo or the
user's own session on systemd-logind). Then:
systemctl --user daemon-reload &&
systemctl --user enable --now circuit-muse &&
systemctl --user status circuit-muse.

Adjust /home/USER to the real checkout path. OMP_THREAD_LIMIT=1
is measured: ~1s/sim vs ~31s CPU burn without it (backend.py note).

Hardening status (this branch — done, verified 2026-10-31):
- CORS allowlist, body cap 65536, request timeout 320s/504,
  public margin cap 9 cells (UI + API), in-app runs prune
  (keep 200, 7d). Backend pytest 30 passed, vitest 43 passed,
  tsc clean, GW baseline sim identical before/after.

User runbook (commands for the user, in order):
1. New laptop: verify toolchain:
   ngspice --version; which openvaf; ls -la server/ptft_fit.osdi;
   tailscale ip -4   # expect 100.69.9.76
2. New laptop: BIND_HOST=100.69.9.76 python3 server/app.py &
   then: curl -s http://100.69.9.76:8768/health
   (from the OLD laptop over Tailscale, not from the public net)
3. New laptop: loginctl enable-linger waterfirst (once), install
   the unit above, systemctl --user daemon-reload &&
   systemctl --user enable --now circuit-muse.
4. Old laptop: mkdir -p ~/web/circuit-muse && copy dist/* there.
5. Old laptop: add limit_req_zone to http{} + the server block,
   sudo nginx -t && sudo systemctl reload nginx.
6. Verify public: curl -s https://waterfirst.pro/circuit-muse/
   -> 200; curl -s https://waterfirst.pro/circuit-muse/api/presets
   | head -c 120; then open the page and run one GW sim.
   If the sim spins, the /circuit-muse/api/ proxy is not active
   (browser fell back to localhost:8768).
