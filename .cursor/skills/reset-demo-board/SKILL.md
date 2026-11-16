---
name: reset-demo-board
description: Resets the Mars Bank Jira demo board and its demo pull requests. Use when the user says reset the board, reset the Jira tickets, reset MARS-N, or reset the demo pull requests.
disable-model-invocation: true
---

# Reset the Mars Bank demo board

Do not reset unless the user asked. Do not edit `features.md`. Do not edit the plan file.

## Where

- Site: https://fe-anysphere-demo.atlassian.net
- cloudId: `564eb250-21c1-45d7-81f9-527d6bf705ad`
- Project: `MARS`
- Board: https://fe-anysphere-demo.atlassian.net/jira/software/projects/MARS/board
- Stories: `MARS-1` through `MARS-11`, label `marsbank-demo`
- The board has no sprints. Columns are To Do, In Progress, and Done. The workflow has no In Review status; never move a story to In Review.
- Pull requests live in `github.com/bkarciauskas/marsbank`.

## Demo phases

A reset restores each story to its demo phase. It does not put every story in unassigned To Do.

Ben Karciauskas's accountId is `712020:03561c63-15cd-478b-a933-718f6a201f8e`. Set the assignee with `assignee: { "accountId": "..." }`, or `assignee: null` to clear it. Transition ids: `11` To Do, `21` In Progress, `31` Done.

| Stories | Status | Assignee | Description | Pull requests |
| --- | --- | --- | --- | --- |
| `MARS-1`, `MARS-2` | In Progress | Ben | Leave as is | Keep open: PR 30 and PR 31 are the For Review pair. Do not close them or delete their branches. |
| `MARS-3` | Done | Leave as is | Leave as is | Merged. Do not transition the story. Do not close the pull request or delete its branch. |
| `MARS-4`, `MARS-5` | In Progress | Ben | Restore from `features.md` | None expected. Close any unmerged one that names the key and delete its head branch. |
| `MARS-6` through `MARS-11` | To Do | none (cleared) | Restore from `features.md` | Close unmerged ones that name the key and delete their head branches. |

`MARS-1` and `MARS-2` stay In Progress and their Cursor cards stay For Review. Never transition them to To Do. `MARS-3` stays Done: do not transition it.

## Scope

- The user names one key (`reset MARS-N`): reset only that story. `N` is 1 through 11.
- The user says reset the board, reset the Jira tickets, reset the demo pull requests, or reset everything: reset `MARS-1` through `MARS-11`.
- Token payment requests is checked in the source file and its pull request is already merged. It is not a demo ticket. Leave it alone.

## Description source

Original descriptions live in `/cursor/stores/bc-7f1a60e0-ea46-4d78-9dca-57979f5bcd65/docs/features.md`. Each demo feature links its `MARS` key. Do not tick or untick those checkboxes during a reset.

The description to restore is that feature's sentence plus its Layers line:

1. Find the bullet whose link is that exact key.
2. The sentence is the prose after the em dash on that bullet.
3. The Layers line is the following `*Layers:*` line. Keep it on its own line under the sentence.

Match the key as a whole token. `MARS-1` is not `MARS-10` or `MARS-11`.

## For each story

1. Read the current issue. Look up its phase in the table above.
   - `MARS-3` stays Done. Do not transition it, and do not change its assignee or description.
   - If the status differs, transition it to that status (`21` In Progress for `MARS-1`, `MARS-2`, `MARS-4`, and `MARS-5`; `11` To Do for `MARS-6` through `MARS-11`).
   - Set the assignee: Ben's accountId for `MARS-1`, `MARS-2`, `MARS-4`, and `MARS-5`; clear it (null) for `MARS-6` through `MARS-11`.
   - Restore the description from `features.md` for `MARS-4` through `MARS-11`. Leave the `MARS-1`, `MARS-2`, and `MARS-3` descriptions. Leave the `marsbank-demo` label.
2. Pull requests in `bkarciauskas/marsbank`:
   - `MARS-1`, `MARS-2`: do nothing. Do not close PR 30 or PR 31 and do not delete their branches.
   - `MARS-3`: do nothing. Its pull request merged. Do not close it and do not delete its branch.
   - `MARS-4` through `MARS-11`: find unmerged open pull requests whose title or body names that key. Close each without merging and delete its head branch.
   - Do not touch pull requests that do not name a `MARS` key. Do not touch merged pull requests.
3. Tell the user the key, its restored status and assignee, and which pull requests were closed or kept. If none were open, say so.
