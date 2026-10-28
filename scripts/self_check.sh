#!/usr/bin/env bash
# Full self-check: backend suite + frontend tests + production build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/server"
export PYTHONPATH=.
export NO_PROXY='*' no_proxy='*' HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy= ALL_PROXY= all_proxy=
python3 -m unittest discover -s tests
cd "$ROOT"
npm test
npm run build
echo "SELF-CHECK OK"
