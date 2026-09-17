# Submission checklist (Track 2)

Deadline: **September 17, 2026, 3:00pm PDT** — the form, not a commit. Whatever
is on `main` when the event ends is what's judged (`docs/submission.md`).

## Repo structure — required, already done ✅

- [x] `docker-compose.yml` at repo root (not nested)
- [x] `claims.json` at repo root
- [x] `REPORT.md` at repo root
- [x] `data/` is empty in git — only `data/README.md` and `data/checksums.txt`
      are tracked; `data/raw`, `data/prepped`, `data/synthetic` are gitignored
      (source data license forbids redistributing derivatives)
- [x] README lists the AI models / coding assistants used (`README.md` →
      "AI disclosure" section)
- [x] Only one `docker-compose.yml` in the repo (there's nowhere on the form
      to say which one to use if there were more than one)

## Verify before submitting — run this exact sequence

```bash
git clone https://github.com/arhrid/MantisGridClusterEfficiency.git fresh-check
cd fresh-check
# generate data/ the way the judges will:
# 1. curl -O https://mantisgrid-hackathon.s3.us-east-1.amazonaws.com/track-2-raw.zip
#    unzip track-2-raw.zip -d data/raw
# 2. docker compose run --rm prep
# 3. docker compose run --rm generate
# 4. docker compose run --rm prep python scripts/checksum_data.py   # expect "Your data matches."
docker compose up          # dashboard on :3000, api on :8000, mantisgrid-api on :8001
python3 scripts/validate_submission.py --claims claims.json --url http://localhost:3000
```

Last run of this checklist (2026-09-17, ~2:15pm PDT) on the maintainer's
machine: all steps passed, `validate_submission.py` reported "Submission
looks structurally sound" with one non-blocking warning (no top-level
`*_confidence` field stated — optional, costs nothing per the rules).

## ⚠️ Still needed from the team — nothing below this line is done yet

- [ ] **Make the GitHub repo public.** It is currently **private**. Judges
      clone the link from the form; a private repo cannot be judged. This is
      the single highest-priority remaining item.
      `https://github.com/arhrid/MantisGridClusterEfficiency` → Settings →
      General → Danger Zone → Change visibility → Public.
- [ ] Confirm the work you want judged is the latest commit on `main` before
      the deadline — there is no commit to nominate separately.
- [ ] Record the ~4-minute demo presentation showing the dashboard actually
      working (a live `docker compose up` + walkthrough of the three tiles is
      strongly encouraged over slides alone).
- [ ] Fill in and submit the form: **https://forms.gle/UbPSwZhKNfkovM8s5**
      - **Team**: every member, each with student or career status —
        _fill in here_
      - **Project title**: _e.g. "Fleet Intelligence — GPU Cluster Efficiency
        Dashboard", or your team's preferred title_
      - **Project description**: one or two sentences — see `README.md`'s
        opening line for a draft
      - **Track**: Track 2 — Cluster efficiency
      - **Repository**: `https://github.com/arhrid/MantisGridClusterEfficiency`
      - **Presentation**: _link to the ~4-minute video_

## What's genuinely distinctive about this submission (for the demo/pitch)

- A calibrated recoverable range ($269,941–$782,761), not a single guessed
  number, split into "fact" (hardware faults, wallclock kills) vs "judgment"
  (slow cancellations, idle sessions) categories, each confidence-weighted —
  see `claims.json`'s `recoverable_gpu_hours.basis`.
- CANCELLED is explicitly *not* treated as blanket waste, with a documented
  rationale — avoids the single most common mistake called out in
  `docs/traps.md`.
- Full click-through drill-down: dollar figure → recommendation → specific
  jobs → raw scheduler/DCGM rows.
- Evidence-backed node triage (e.g. `r7317916-n172107`: 10 affected users
  fail 6.12x more *on this node* than everywhere else they run — ruling out
  user error with a join, not an assertion).
- The real MantisGrid facsimile API runs as its own service
  (`mantisgrid-api`, port 8001; Layer A findings/causal/neighbor/rules, Layer
  B efficiency/waste/recommendations), built from checksum-verified data.
- A live, visible cross-check: the dashboard's independently-computed
  completed-work percentage (16.96%) is checked against the official API's
  `/v1/efficiency/summary` (16.97%) at startup and shown as a badge in the
  header — two independent methods agreeing is stronger evidence than either
  alone.
