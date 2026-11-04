#!/usr/bin/env python3
"""Release gate: fail if company/private data or secrets leak into the tree.

Checks tracked files that would be committed (not server/runs contents,
which are gitignored except the sample allowlist):
- personal checkout paths and home dirs
- tailnet IPs, API keys/tokens, credentials
- tracked runs beyond the sample allowlist
Run: python3 scripts/check_no_company_data.py
"""
import re
import subprocess
import sys

PATTERNS = [
    (r"coka" + "cdir", "personal checkout path"),
    (r"/home/[A-Za-z0-9_.-]+/", "personal home path"),
    (r"100\.\d+\.\d+\.\d+", "tailnet/private IP"),
    (r"192\.168\.\d+\.\d+", "private IP"),
    (r"10\.\d+\.\d+\.\d+", "private IP"),
    (r"(?i)(api[_-]?key|api[_-]?secret|hf[_-]?token|provider[_-]?key)\s*[:=]\s*\S+", "possible secret"),
    (r"sk-[A-Za-z0-9]{8,}", "possible secret key"),
    (r"xox[bap]-", "possible slack token"),
    (r"AKIA[0-9A-Z]{16}", "possible AWS key"),
    (r"ghp_[A-Za-z0-9]{20,}", "possible github token"),
]

def tracked_files():
    out = subprocess.run(["git", "ls-files"], capture_output=True,
                         text=True, check=True)
    return [f for f in out.stdout.splitlines() if f]


SKIP_SELF = {"scripts/check_no_company_data.py"}

def main():
    fails = []
    files = tracked_files()
    # runs audit: only README/sample decks may be tracked
    runs = [f for f in files if f.startswith("server/runs/")]
    bad_runs = [f for f in runs
                if not f.startswith("server/runs/_sample/")]
    if bad_runs:
        fails.append(f"tracked generated runs: {len(bad_runs)} files "
                     f"(e.g. {bad_runs[0]}); keep only server/runs/_sample/")
    for f in files:
        if f.startswith("server/runs/"):
            continue
        try:
            with open(f, "r", encoding="utf-8", errors="strict") as fh:
                text = fh.read()
        except (OSError, ValueError):
            continue  # binary, skip
        if f in SKIP_SELF:
            continue
        for pat, label in PATTERNS:
            for m in re.finditer(pat, text):
                hit = m.group(0)
                fails.append(f"{f}: {label}: {hit[:60]!r}")
                break
    if fails:
        print("COMPANY-DATA CHECK FAILED:")
        for x in fails[:30]:
            print(" -", x)
        return 1
    print(f"company-data check OK ({len(files)} tracked files, "
          f"{len(runs)} runs files).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
