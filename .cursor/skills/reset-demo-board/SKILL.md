---
name: reset-demo-board
description: Resets the Mars Bank Jira demo board, GitHub demo pull requests, Cursor Project board, and Agent SDK bug-triage demo artifacts to demo-ready state without touching marsbank-plan work, demo-example pull requests, or demo-bug-seed tickets. Use when the user says reset the board, reset the Jira tickets, reset MARS-N, reset the demo pull requests, reset bug triage, or reset sdk bugs.
disable-model-invocation: true
---

# Reset the Mars Bank demo board

Do not reset unless the user asked. Do not edit `features.md`. Do not edit `demo-plan.md`.

## How the reset skills fit together

A full pre-demo reset pairs [.cursor/skills/demo-reset/SKILL.md](../demo-reset/SKILL.md) with this skill.

1. Run `demo-reset` Teardown to revert any planted hold, stop `verify-marsbank`, restore the Mars Bank app ledger and `/demo` scenarios, and close disposable demo pull requests.
2. Run `reset-demo-board` to restore the Jira `MARS` board, retire `slack-demo` artifacts, reset Agent SDK bug-triage demo artifacts (Jira bugs, bot fix PRs, and EC2 bot state), and sync the Cursor Project board.
3. Run `demo-reset` Pre-demo (`refresh-demo-examples.mjs`) to rebase open `demo-example` pull requests (#30, #31, and #35) onto `origin/main` and confirm green CI.

A board reset on its own runs this skill only. It does not rebase `demo-example` branches unless asked.

## Where

- The Jira site is https://fe-anysphere-demo.atlassian.net with cloudId `564eb250-21c1-45d7-81f9-527d6bf705ad`.
- The Jira board is https://fe-anysphere-demo.atlassian.net/jira/software/projects/MARS/board in project `MARS`.
- Feature demo stories are `MARS-1` through `MARS-11` with label `marsbank-demo`.
- Engineering plan stories are `MARS-12` through `MARS-21` and any future story with label `marsbank-plan`.
- Pre-seeded duplicate-catch Jira Bugs for the Agent SDK triage demo are `MARS-23` ("Overpaying Expedition Credit card silently loses the extra tokens") and `MARS-24` ("Activity sol headings show negative sols after a new transfer"), both labeled `demo-bug-seed`.
- Live `#mars-bank-support` triage runs file new `MARS` `Bug` issues (without `demo-bug-seed`) and open bug-fix pull requests in `github.com/bkarciauskas/marsbank`.
- Temporary Slack showcase items carry the `slack-demo` label on Jira or GitHub.
- The Jira board has no sprints. Columns are `To Do`, `In Progress`, and `Done`. The workflow has no `In Review` status. Never move a story to `In Review`.
- Pull requests live in `github.com/bkarciauskas/marsbank`.
- The `slack-bug-triage` Agent SDK bot runs on AWS EC2 at `ubuntu@54.252.242.243` (`slack-bug-triage.service`, `/opt/cursor-sdk-demos/demos/slack-bug-triage`), reachable over SSH from Ben's MacBook self-hosted worker (`ssh -i ~/.ssh/id_ed25519 ubuntu@54.252.242.243`).
- Inside the Mars Bank Cursor Project, the Project coordinator runs `UpdateTrackedTasks` and `CreateTrackedTasks`. Worker subagents only have read-only `ListTrackedTasks` access. They report needed board updates to the coordinator with `SendToAgent`. Outside the Cursor Project, skip tracker tool calls and report any board updates needed.

## Demo-ready state

A reset puts each group into its demo phase. It never touches `marsbank-plan` engineering work.

Ben Karciauskas's Jira accountId is `712020:03561c63-15cd-478b-a933-718f6a201f8e`. Set the Jira assignee with `assignee: { "accountId": "..." }` or clear it with `assignee: null`. Jira transition ids are `11` for `To Do`, `21` for `In Progress`, and `31` for `Done`.

| Stories | Jira | GitHub pull requests | Cursor Project board |
| --- | --- | --- | --- |
| `MARS-1` (#30), `MARS-2` (#31), `MARS-4` (#35) | `In Progress`, assigned to Ben Karciauskas. Keep current descriptions. | Keep open `demo-example` pull requests (#30, #31, #35) and their branches open. Close other unmerged pull requests for the key and delete their branches. | `For Review` (`for-review`), owned by Ben, `Feature` tag, linked to PRs #30, #31, and #35. |
| `MARS-3` (#33) | `Done`, assigned to Ben. Keep current description. Do not transition. | Merged in #33. Leave #33 and its branch untouched. | `Done` (`done`), owned by Ben, `Feature` tag, linked to PR #33. |
| `MARS-5` | `To Do` (`11`), assigned to Ben Karciauskas. Restore description from `features.md`. | Close any unmerged non-`demo-example` pull request naming `MARS-5`. Delete its branch. | `Queued` (`queued`), owned by Ben Karciauskas, `Feature` tag, with stale PR and active worker links removed. |
| `MARS-6` through `MARS-11` | `To Do`, assignee cleared to `null`. Restore descriptions from `features.md`. | Close any unmerged non-`demo-example` pull request naming the key and delete its branch. Leave merged pull requests untouched. | `Queued` (`queued`), unowned, `Feature` tag, with stale PR and worker links removed. |
| `MARS-12` through `MARS-21` and any `marsbank-plan` story | Preserve as real engineering state. Never move status, change assignee, or overwrite descriptions. | Never close open pull requests or delete branches for `marsbank-plan` stories. | Preserve `Demo Plan` tasks (`MARS-12` through `MARS-21` and any `marsbank-plan` work in their current status, including `Done` and `Canceled` items). |
| `MARS-23`, `MARS-24` (`demo-bug-seed`) | Keep open in `To Do` (`11`). Transition back to `To Do` if moved; never add `canceled`, overwrite descriptions, or delete. | Leave untouched (no fix PRs expected). | Leave untouched (not tracked as `Feature` or `Demo Plan` tasks). |
| Bot-filed `Bug` issues (no `demo-bug-seed` label) | Add labels `canceled` and `demo-reset` (preserving existing labels) and transition to `Done` (`31`). | Close any open bug-fix PR from a triage demo run without merging and delete its branch. Flag merged fixes for unfiled demo bugs for revert. | Move any ad-hoc triage task to `Canceled` (`canceled`) and clear active links. |
| Temporary `slack-demo` items | Transition to `Done` (`31`), clear assignee to `null`, and add a reset comment. | Close any unmerged `slack-demo` pull request without merging. Delete its branch. | Move any ad-hoc `slack-demo` task to `Canceled` (`canceled`) and remove stale PR or worker links. |

## Scope

- When the user names one key with `reset MARS-N` for `N` in `1` through `11`, reset only that story across Jira, GitHub, and the Cursor Project board.
- When the user names `MARS-12` through `MARS-21` or any `marsbank-plan` story, refuse unless the user explicitly confirms editing engineering plan work.
- When the user says `reset bug triage` or `reset sdk bugs`, run only step 4 (Agent SDK bug-triage demo reset) and step 5 (summary) without modifying `MARS-1` through `MARS-11` or `slack-demo` items.
- When the user says reset the board, reset the Jira tickets, reset the demo pull requests, or reset everything, run all steps: reset `MARS-1` through `MARS-11`, retire all `slack-demo` artifacts, reset the Agent SDK bug-triage demo artifacts (Jira bugs, bot fix PRs, and EC2 bot state), and sync the Cursor Project board.
- Token Payment Requests is checked in `features.md` and its pull request (#25) is already merged. Leave it alone.
- Any open pull request labeled `demo-example` (#30, #31, and #35) stays open and keeps its head branch. Never close it or delete its branch during a reset.

## Description source

Original descriptions for `MARS-5` through `MARS-11` live in `/cursor/stores/bc-7f1a60e0-ea46-4d78-9dca-57979f5bcd65/docs/features.md`. Each demo feature links its `MARS` key. Do not tick or untick checkboxes during a reset.

Restore that feature's sentence plus its Layers line.

1. Find the bullet whose link matches that exact key as a whole token (`MARS-1` is not `MARS-10` or `MARS-11`).
2. Take the sentence after the dash on that bullet.
3. Place the following `*Layers:*` line on its own line under the sentence.

## Steps

1. Update Jira stories in scope (full board reset or `reset MARS-N`).
   - Leave `MARS-3` in `Done` assigned to Ben with its current description.
   - Keep `MARS-1`, `MARS-2`, and `MARS-4` in `21` `In Progress`, assigned to Ben Karciauskas. Leave their current descriptions untouched.
   - Transition `MARS-5` to `11` `To Do` if needed. Set Ben Karciauskas (`712020:03561c63-15cd-478b-a933-718f6a201f8e`) as assignee and restore its description from `features.md` with `editJiraIssue`. Keep the `marsbank-demo` label.
   - Transition `MARS-6` through `MARS-11` to `11` `To Do` if needed. Clear `assignee` to `null` and restore each description from `features.md`. Keep the `marsbank-demo` label.
   - Never touch `MARS-12` through `MARS-21` or any issue carrying the `marsbank-plan` label.
   - On a full board reset, query `project = MARS AND labels = slack-demo` with `searchJiraIssuesUsingJql`. The Atlassian MCP server has no delete-issue tool. Transition each open `slack-demo` issue to `31` `Done` with `transitionJiraIssue`. Clear `assignee` to `null` with `editJiraIssue`. Post a short reset note with `addOrEditJiraIssueComment`.
2. Clean up disposable GitHub pull requests in `bkarciauskas/marsbank` (full board reset or `reset MARS-N`).
   - Skip every open pull request labeled `demo-example` (#30, #31, and #35) and keep its head branch.
   - Skip every open pull request for `marsbank-plan` stories (`MARS-12` through `MARS-21` or any `marsbank-plan` issue).
   - Close any other unmerged pull request whose title or body names a `MARS-1` through `MARS-11` key in scope as a whole token, without merging. Delete its head branch.
   - On a full board reset, close any unmerged pull request labeled `slack-demo` or referencing a `slack-demo` issue without merging. Delete its head branch.
   - Leave all merged pull requests and their branches untouched, including #33 on `MARS-3`.
3. Sync the Cursor Project board (full board reset or `reset MARS-N`).
   - The Project coordinator writes task updates with `UpdateTrackedTasks` (and `CreateTrackedTasks` only if a canonical `Feature` task is missing). Workers read with `ListTrackedTasks` and send needed updates to the coordinator.
   - Keep `MARS-1` (#30), `MARS-2` (#31), and `MARS-4` (#35) in `For Review`, owned by Ben, tagged `Feature`, linked to PRs #30, #31, and #35.
   - Keep `MARS-3` (#33) in `Done`, owned by Ben, tagged `Feature`.
   - Set `MARS-5` to `Queued` (`queued`), owned by Ben Karciauskas, tagged `Feature`, with stale PR and active worker links removed.
   - Set `MARS-6` through `MARS-11` to `Queued`, unowned, tagged `Feature`, with stale PR and worker links removed.
   - Move any ad-hoc `slack-demo` task to `Canceled` and clear active links.
   - Leave all `Demo Plan` tasks (`MARS-12` through `MARS-21` and any `marsbank-plan` items) untouched.
4. Reset Agent SDK bug-triage demo artifacts (full board reset, `reset bug triage`, or `reset sdk bugs`).
   - **Preserve pre-seeded duplicate-catch Jira Bugs (`demo-bug-seed`):**
     - Check `MARS-23` ("Overpaying Expedition Credit card silently loses the extra tokens") and `MARS-24` ("Activity sol headings show negative sols after a new transfer").
     - Keep both open in `11` `To Do` with label `demo-bug-seed`. Transition back to `11` `To Do` if moved; never add `canceled`, overwrite descriptions, or delete them.
   - **Cancel bot-filed Jira Bugs from live demo runs:**
     - Query `project = MARS AND issuetype = Bug AND (labels is EMPTY OR labels not in (demo-bug-seed, canceled))` with `searchJiraIssuesUsingJql`.
     - Skip any issue carrying `demo-bug-seed` or `marsbank-plan`.
     - For each bot-filed `Bug`, add labels `canceled` and `demo-reset` (preserving existing labels) with `editJiraIssue` so `slack-bug-triage`'s Jira query (`labels is EMPTY OR labels != canceled`) ignores it on future duplicate checks, then transition it to `31` `Done` with `transitionJiraIssue`.
     - If any ad-hoc triage task exists on the Cursor Project board, move it to `Canceled` and clear active links.
   - **Close bot-opened GitHub bug-fix pull requests on `bkarciauskas/marsbank`:**
     - Close (without merging) any open bug-fix pull request opened during a triage demo run and delete its head branch.
     - Never touch `demo-example` pull requests (#30, #31, and #35), `marsbank-plan` pull requests, or unrelated feature pull requests.
     - Check whether a bug-fix PR for either unfiled demo bug — Activity search ignoring account/payee names, or `sentThisSol` counting received credits — was merged into `main`. If merged, flag it clearly to the user and offer to revert that merge commit so the demo bug is reproducible again. Never silently force-push `main`.
   - **Reset the AWS EC2 `slack-bug-triage` bot state (`ubuntu@54.252.242.243`):**
     - Run via Ben's MacBook self-hosted worker (`ssh -i ~/.ssh/id_ed25519 ubuntu@54.252.242.243`):
       - Stop the service: `sudo systemctl stop slack-bug-triage.service`.
       - Remove `/opt/cursor-sdk-demos/demos/slack-bug-triage/.demo-state` (clears `agent-store/`, `created.json`, and `marsbank/`; never touch `/etc/slack-bug-triage.env` or `.env`).
       - Re-run `npm run setup` as `ubuntu` in `/opt/cursor-sdk-demos/demos/slack-bug-triage` with `/etc/slack-bug-triage.env` loaded so `.demo-state/marsbank` re-clones cleanly from `origin/main` while preserving `ubuntu:ubuntu` ownership.
       - Start the service (`sudo systemctl start slack-bug-triage.service`) and confirm `systemctl is-active slack-bug-triage.service` outputs `active`.

       ```bash
       ssh -i ~/.ssh/id_ed25519 ubuntu@54.252.242.243 '
         set -euo pipefail
         sudo systemctl stop slack-bug-triage.service
         rm -rf /opt/cursor-sdk-demos/demos/slack-bug-triage/.demo-state
         cd /opt/cursor-sdk-demos/demos/slack-bug-triage
         set -a && source /etc/slack-bug-triage.env && set +a
         npm run setup
         sudo systemctl start slack-bug-triage.service
         systemctl is-active slack-bug-triage.service
       '
       ```

     - If Ben's MacBook self-hosted worker is offline, complete the Jira and GitHub cleanup above and note that EC2 `.demo-state/` cleanup waits for `agent worker start`.
5. Report a concise summary of what changed.
   - When board stories were in scope: list each updated `MARS` key, its Jira and Cursor Project board state, and which pull requests were closed or kept (say so if none were closed).
   - When bug-triage artifacts were in scope: confirm pre-seeded bugs (`MARS-23`, `MARS-24`) remain in `To Do`, list which bot-filed Jira bugs were canceled, list which bot fix PRs were closed (and any merged-revert warnings for unfiled demo bugs), and confirm the EC2 `slack-bug-triage.service` state reset (or note it is waiting for `agent worker start`).
