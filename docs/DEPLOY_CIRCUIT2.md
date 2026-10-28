# Deploy: waterfirst.pro/circuit2/

Target layout (old laptop, same pattern as `/circuit/`):

- static: `~/web/circuit2/` ← contents of a `--base=/circuit2/` build
- API: `https://waterfirst.pro/circuit2/api/*` → sim backend (`:8768`)
  via nginx `proxy_pass` (frontend tries same-origin first, then
  falls back to `http://127.0.0.1:8768` for local dev).

## 0. Build the /circuit2/ bundle (this laptop)

```bash
cd ~/meta_muse/gw-react
npx vite build --base=/circuit2/ --outDir /tmp/c2root/circuit2
# smoke: page + asset paths
grep -o 'src="[^"]*"' /tmp/c2root/circuit2/index.html
```

Do NOT commit this bundle over `dist/` (committed `dist/` stays
`base: "/circuit-muse/"`).

## 1. Copy static to the old laptop

From the old laptop (or scp from here):

```bash
mkdir -p ~/web/circuit2
scp -r /tmp/c2root/circuit2/* old-laptop:~/web/circuit2/
```

## 2. Backend (pick A or B)

Option A — backend on the old laptop (needs python3 + ngspice there):

```bash
git clone https://github.com/waterfirst/muse-circuit-simulation ~/muse-circuit-simulation
cd ~/muse-circuit-simulation
python3 server/app.py   # 127.0.0.1:8768
```

Option B — backend stays on this laptop; nginx proxies to its
Tailscale IP (find it with `tailscale ip -4` on this laptop):

```bash
# this laptop
cd ~/meta_muse/gw-react && python3 server/app.py   # 127.0.0.1:8768
```

systemd user unit (either host), `~/.config/systemd/user/gw-muse.service`:

```ini
[Unit]
Description=gw-react sim backend (Muse)
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/USER/muse-circuit-simulation/server/app.py
Restart=on-failure
Environment=OMP_THREAD_LIMIT=1

[Install]
WantedBy=default.target
```

```bash
systemctl --user daemon-reload && systemctl --user enable --now gw-muse
```

## 3. nginx (old laptop, needs sudo reload by the user)

```nginx
location = /circuit2 { return 301 /circuit2/; }
location /circuit2/ {
  alias /home/USER/web/circuit2/;
  index index.html;
}
location /circuit2/api/ {
  proxy_pass http://127.0.0.1:8768/api/;   # option B: http://<TAILNET-IP>:8768/api/;
  proxy_read_timeout 300s;
  proxy_connect_timeout 10s;
}
```

Note the trailing slashes on BOTH sides of `proxy_pass`: they strip the
`/circuit2` prefix so `/circuit2/api/sim` reaches the backend as `/api/sim`.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://waterfirst.pro/circuit2/
curl -s https://waterfirst.pro/circuit2/api/presets | head -c 120; echo
```

Then open `https://waterfirst.pro/circuit2/#/` in a browser and run a sim.
If the sim spins forever, the browser fell back to localhost:8768 —
the nginx `/circuit2/api/` proxy is not in effect yet.
