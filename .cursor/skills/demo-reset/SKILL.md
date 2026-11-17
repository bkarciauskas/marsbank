---
name: demo-reset
description: Refresh kept-open Mars Bank demo-example pull requests onto main, or restore the worktree, app ledger, disposable demo pull requests, and Project board after a demo without touching marsbank-plan work. Never merge, and never force-push main.
disable-model-invocation: true
---

# Demo reset

Work from the repository root. Read the request and pick the matching flow.

- When the human asks to prepare or refresh the `demo-example` pull requests, run Pre-demo and stop.
- When the human types `/demo-reset`, run Teardown and stop.
- When the human asks for a full pre-demo reset, run Teardown, then [.cursor/skills/reset-demo-board/SKILL.md](../reset-demo-board/SKILL.md), then Pre-demo.

## How the reset skills fit together

`demo-reset` owns the local checkout, the Mars Bank app ledger, disposable demo pull requests, and rebasing `demo-example` branches onto `main`. [.cursor/skills/reset-demo-board/SKILL.md](../reset-demo-board/SKILL.md) owns the Jira `MARS` board (`MARS-1` through `MARS-11` and `slack-demo` cleanup) and the Cursor Project board.

Inside the Mars Bank Cursor Project, the Project coordinator runs `UpdateTrackedTasks` and `CreateTrackedTasks`. Worker subagents only have read-only `ListTrackedTasks` access. They report needed board updates to the coordinator with `SendToAgent`.

## Pre-demo

Run `node .cursor/skills/demo-reset/scripts/refresh-demo-examples.mjs`.

The script dynamically lists every open pull request labeled `demo-example` (currently #30 on `MARS-1`, #31 on `MARS-2`, and #35 on `MARS-4`). It rebases each branch onto `origin/main` and pushes that head with `--force-with-lease`. It waits for `typecheck`, `lint`, and `test` and prints a red/green table. The failing `demo-example` check on those pull requests is intentional and keeps them unmerged.

When a rebase conflicts, the script aborts that pull request and names the files. Leave the conflict. Do not resolve it. Do not merge these pull requests. Do not force-push `main`.

## Teardown

1. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs revert`. Require JSON `state` of `healthy`.
2. Run `node .cursor/skills/verify-marsbank/scripts/cleanup.mjs` even when no instance exists.
3. Run `git status` and report leftover files from `/demo-fix`. Leave them unless the human asks to drop them.
4. Reset the Mars Bank app ledger and `/demo` state when a local server is running (such as port `3021` or `3000`). Send `POST /api/demo` with `{"action":"reset-all"}` to restore all six resident registers, clear active `/demo` scenarios, uninstall hook kits, and revert `/demo` guardrail files. Use `POST /api/reset` with `{"confirmation":"RESET ALL REGISTERS"}` while signed in if `git status` showed local `transfer-form.tsx` edits to keep. When no server is running and `DATABASE_URL` is unset, the in-memory ledger starts seeded on next launch.
5. In `bkarciauskas/marsbank`, close only disposable unmerged demo pull requests without merging. Delete their head branches.
   - Disposable pull requests are open pull requests without the `demo-example` label that name `MARS-1` through `MARS-11` as a whole token, carry or reference `slack-demo`, or come from `/demo` or `/demo-fix` test runs.
   - Skip every open pull request labeled `demo-example` (#30 on `MARS-1`, #31 on `MARS-2`, and #35 on `MARS-4`) and keep its head branch.
   - Never close or touch open pull requests that belong to `marsbank-plan` stories (`MARS-12` through `MARS-20` or any future `marsbank-plan` story) or general engineering pull requests.
   - Never touch merged pull requests or their branches, including #33 for `MARS-3`.
6. Sync the Cursor Project board for any pull request closed in step 5 (run by the Project coordinator with `UpdateTrackedTasks`).
   - Keep `MARS-1` (#30), `MARS-2` (#31), and `MARS-4` (#35) in `For Review` (`Feature` tag, owned by Ben, PR links intact).
   - Keep `MARS-3` (#33) in `Done` (`Feature` tag, owned by Ben).
   - Restore `MARS-5` to `In Progress` (`Feature` tag, owned by Ben, with no PR or active worker link).
   - Restore `MARS-6` through `MARS-11` to `Queued` (`Feature` tag, unowned, with stale PR and worker links removed).
   - Move any ad-hoc `slack-demo` task or disposable `/demo-fix` test task to `Canceled` and clear active links.
   - Leave all `Demo Plan` tasks (`MARS-12` through `MARS-20` and any `marsbank-plan` stories) untouched.

Do not run `git reset --hard`. Do not force-push `main`. Do not merge. Do not delete the progress canvas or `verify-marsbank` evidence.
