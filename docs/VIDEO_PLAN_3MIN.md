# 3-min video plan — CircuitLens EM verification (Meta hackathon)

Hero: ONE patent, ONE claim, ONE Muse run.
Patent Samsung US 11,205,374 B2 Fig.4 (EM driver stage).
Claim: "4H start pulse -> 3H outputs, shifting 1H per stage."
Result: measured 3.01H, every stage exactly one ordered pulse. All sizes
synthetic; topology + behavior reproduced, not silicon.

## Timeline (180s)

| # | 0:00-0:20 Problem | 0:20-1:00 Muse reads | 1:00-2:00 tools run | 2:00-2:40 proof | 2:40-3:00 close |
|---|---|---|---|---|---|
| Visual | Patent PDF Fig.4 + dense text; reviewer question mark | Source-trace table highlights row by row; schematic builds up | Terminal: ngspice runs; waveforms animate; PASS badges pop | Rerun diff: max\|dV\|=0; audit checklist greens; test counts | Live URL; one-line tagline |
| Narration | A1 | A2 | A3 | A4 | A5 |

## Narration (EN, conversational — read relaxed, not announce-y)

A1 (0:00-0:20): "Here's the thing about display patents. The circuit's right
there in Figure 4 — but is the description actually right? Nobody has time to
rebuild every claim by hand. So we asked: what if an agent could just... do it?"

A2 (0:20-1:00): "We gave Muse one patent, Samsung's emission driver. It read
the text, pulled out all twelve transistors and three capacitors, and linked
every single wire back to the sentence it came from. See that table? Each row
is a claim about the circuit — with its receipt attached."

A3 (1:00-2:00): "Then Muse did the real work: wrote the netlist, fired up
ngspice, and simulated four stages over two frames. About a second later —
there it is. Four-H start goes in, three-H pulses come out, marching down the
stages one by one. Exactly what the patent says."

A4 (2:00-2:40): "But can you trust it? We re-ran every saved deck from scratch
— bit-identical waveforms. An independent audit matched all twelve transistors
against the patent text, and the full test suite — backend and frontend — is
green. Nothing here runs on vibes."

A5 (2:40-3:00): "CircuitLens: Muse turns a circuit PDF into an executable
verification. Try it live — link below."

## Captions

Burn in EN subtitles (matches narration above). Keep on screen 1-2 lines,
min 1.2s per card. Export matching .srt for the submission form.

## Assets to capture (in order)

1. `docs/CIRCUITS.md` EM table + Google Patents Fig.4 screenshot (fair-use excerpt, cite number on screen).
2. Lab page: EM preset -> SourceTrace table scroll; SchemEditor schematic.
3. Terminal: `ngspice -b job.cir` run + PASS output (real run, ~1s; slow to 3s in edit).
4. WavePlot: OUT1-OUT4 staggered pulses; annotate 4H->3.01H.
5. Rerun proof: `/tmp/verify_rerun.py` output (max|dV|=0.00e+00, MISMATCHES: 0).
6. `self_check.sh` tail: 21/21 + 42/42 + SELF-CHECK OK.
7. Live site `https://waterfirst.pro/circuit2/#/` (fallback: local preview).

## Production steps

1. Record screen captures 2-6 at 1080p (local run; hide personal paths where easy, `~/meta_muse` is fine).
2. TTS narration A1-A5 (EN, conversational voice; normalize loudness; no robot pacing — pause at the "..." marks).
3. Edit: cuts on sentence ends; zoom-ins on table rows and 3.01H annotation; background music low (-20dB), duck under voice.
4. Burn captions + export .srt; total 2:50-3:00.
5. Pre-submit checklist: patent number visible; "synthetic sizes" disclaimer on screen once; no company data; repo link + live URL in description.

## Out of scope for this video

GC/GI reuse story, Claude comparison, pixel aging detail — appendix material only.
If asked in Q&A: "GC/GI reuse the EM stage, disclosed as an assumption; pixel
currents are illustrative from a synthetic OLED card."
