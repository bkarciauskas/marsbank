---
name: demo-reset
description: Refresh kept-open Mars Bank demo pull requests onto main, or restore the worktree after a pstack demo. Use when a human types /demo-reset, or asks to prepare or refresh pull requests labeled demo-example. Never merge, and never force-push main.
disable-model-invocation: true
---

# Demo reset

Work from the repository root. Read the request and run one section.

- The human asks to prepare a demo, or to refresh the demo-example pull requests. Run Pre-demo. Stop.
- The human types /demo-reset. Run Teardown. Stop.

## Pre-demo

Run `node .cursor/skills/demo-reset/scripts/refresh-demo-examples.mjs`.

The script rebases every open pull request labeled `demo-example` onto `origin/main` and pushes that head with `--force-with-lease`. It then re-runs CI and prints a red/green table.

When the rebase conflicts, the script aborts that pull request and names the files. Leave the conflict. Do not resolve it. Do not merge these pull requests. Do not force-push `main`.

## Teardown

1. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs revert`.
2. Require JSON `state` of `healthy`.
3. Run `node .cursor/skills/verify-marsbank/scripts/cleanup.mjs` even when no instance exists.
4. Run `git status` and report leftover files from `/demo-fix`. Leave them unless the human asks to drop them.
5. In `bkarciauskas/marsbank`, close every open pull request whose title or body names a `MARS` key, without merging, and delete its head branch. Skip any open pull request labeled `demo-example`, currently #30, #31, and #35, and keep its head branch. GitHub keeps each closed pull request. Do not touch a merged pull request or its branch, including #33 for `MARS-3`.
6. Delete the Cursor tracker card that links each pull request closed in step 5. Leave the card for any `demo-example` pull request. Leave cards whose pull requests merged, including `MARS-3`.

Do not run `git reset --hard`. Do not force-push. Do not merge. Do not delete the progress canvas or `verify-marsbank` evidence.
