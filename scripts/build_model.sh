#!/usr/bin/env bash
# Compile models/ptft_fit.va to server/ptft_fit.osdi with the local OpenVAF.
# Usage: scripts/build_model.sh
# Env: OPENVAF_BIN (default: openvaf), OSDI_OUT (default: server/ptft_fit.osdi)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${OPENVAF_BIN:=openvaf}"
: "${OSDI_OUT:=$ROOT/server/ptft_fit.osdi}"
"$OPENVAF_BIN" --output "$OSDI_OUT" "$ROOT/models/ptft_fit.va"
ls -la "$OSDI_OUT"
