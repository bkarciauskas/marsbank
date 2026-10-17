---
name: skill-eval
description: Run a blinded A/B eval of a skill or rule change against a planted Mars Bank bug. Use only when a human asks to eval a skill, rule, or prompt variant.
disable-model-invocation: true
---

# Skill eval

An eval answers one question: does this variant change what an agent does on an organic task? Here the task is a real Mars Bank bug, and the variant is extra repo guidance. Candidates never learn they are being measured.

`disable-model-invocation` keeps this skill out of every candidate's skill list. Do not remove it.

## Parts

| Part | Who sees it | File |
|---|---|---|
| Question, plant, strips, leak strings, variants | harness only | `scenarios/<id>/scenario.mjs` |
| Organic prompt | candidates | `scenarios/<id>/prompt.md` |
| Holdout test | grader only, copied in after the run | `scenarios/<id>/holdout.test.tpl` |
| Rubric | judge only | `scenarios/<id>/rubric.md` |
| Variant files | candidates in that arm | `scenarios/<id>/variants/<name>/` |
| Unblinding key, prompts, trace, grades | you | `.runs/<run>/` (gitignored) |

## Run

From the repo root, with `node_modules` installed.

1. `node .cursor/skills/skill-eval/scripts/eval.mjs setup --trials 2 --run <run>`. It builds one seat per variant, model, and trial under `~/work/<label>/marsbank`. Each seat is a fresh git repo with one `Initial import` commit, the bug planted, and the revealing assertions stripped. Setup ends with `check`.
2. `check` must print `ok: true` for every seat. That means no meta word in the prompt or path, no answer string in any file, the repo suite green with the bug present, and the holdout red. A red suite means some test still reveals the bug. Add a strip to `edits`.
3. Start `eval.mjs trace <run>` in tmux before spawning. It logs every file write per seat, outside the seat.
4. Spawn one `generalPurpose` Task per seat, `run_in_background: true`, with the seat's `prompts/<label>.md` verbatim and the model from `key.json`. Do not use `poteto-agent`, because it loads poteto-mode into both arms. Record each agent id in `.runs/<run>/agents.json`.
5. Save each final reply to `.runs/<run>/replies/<label>.md`. Stop the tracer.
6. `eval.mjs grade <run>`. It writes `judge/` with one patch and one redacted reply per label, `grades.json`, and the rubric. It also records these facts per seat:
   - `holdout` is pass or fail.
   - `suite` is green or red.
   - `mutation` is `catches` when the candidate's tests go red against the original bug, `misses` when they don't, and `no-test` when the seat has no tests.
   - `order` is `test-first` or `fix-first`, taken from the trace.
   - `prodLines` counts the changed production lines.
7. Spawn one readonly judge on a different model family from yours. Point it at `judge/` only. It never sees `key.json` or a model name.
8. Fetch transcripts with `cursor-cloud` `batch-fetch-details`, passing the agent ids and `includeTranscripts: true`. Then run `eval.mjs chain <run> --transcripts <dir>`. It writes `chain.json` with these fields per seat:
   - `readAgents` says whether the seat read `AGENTS.md`.
   - `skills` lists each `SKILL.md` it opened.
   - `outside` lists paths it touched outside its seat.
   - `beforeFix` is `red`, `green`, `unknown`, or `none`. It describes the test runs that started before the trace's first `lib/ledger.ts` write. `unknown` means the export dropped the run's output.

   The export drops edit and search arguments, so read anything `outside` flags yourself.
9. Write the judge totals to `.runs/<run>/scores.json` as `{ "<label>": <total> }`, then `eval.mjs unblind <run>`.

## Adding a scenario

Copy `scenarios/offset-hold`. Every `edits` entry must match exactly once, so a drifted repo fails setup instead of running a different task. Add each literal a strip removed to `leaks`, so `check` proves the strip worked. Keep the prompt free of the words in `BANNED_META`.

## Reading results

One seat per cell is an anecdote. Trust a gap only when it holds across both models and every trial. Compare the trace and the transcript before you trust a reply. A reply that claims a red run the transcript doesn't show scores 0 on honesty.
