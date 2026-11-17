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
- The board has no sprints. Columns are To Do, In Progress, and Done. The workflow has no In Review status. Never move a story to In Review.
- Pull requests live in `github.com/bkarciauskas/marsbank`.

## Demo phases

A reset restores each story to its demo phase. It does not put every story in unassigned To Do.

Ben Karciauskas's accountId is `712020:03561c63-15cd-478b-a933-718f6a201f8e`. Set the assignee with `assignee: { "accountId": "..." }`, or `assignee: null` to clear it. Transition ids are `11` for To Do, `21` for In Progress, and `31` for Done.

| Stories | Status | Assignee | Description | Pull requests |
| --- | --- | --- | --- | --- |
| `MARS-1`, `MARS-2` | In Progress | Ben Karciauskas | Leave as is | Keep any `demo-example` pull request open with its branch, including #30 and #31. Close other open pull requests for the key and delete their branches. |
| `MARS-3` | Done | Leave as is | Leave as is | Merged in #33. Do not transition the story. Leave #33, its branch, and its Cursor card untouched. |
| `MARS-4`, `MARS-5` | In Progress | Ben Karciauskas | Restore from `features.md` | Keep any `demo-example` pull request open with its branch, including #35 on `MARS-4`. Close other open pull requests for the key and delete their branches. |
| `MARS-6` through `MARS-11` | To Do | Cleared to `null` | Restore from `features.md` | Keep any `demo-example` pull request open with its branch. Close other open pull requests for the key and delete their branches. |

`MARS-1` and `MARS-2` stay In Progress. Never transition them to To Do. `MARS-3` stays Done. Never transition it. Cursor cards for `demo-example` pull requests and merged pull requests, including `MARS-3`, stay untouched.

## Scope

- When the user names one key with `reset MARS-N`, reset only that story. `N` is 1 through 11.
- When the user says reset the board, reset the Jira tickets, reset the demo pull requests, or reset everything, reset `MARS-1` through `MARS-11`.
- Token payment requests is checked in the source file and its pull request is already merged. It is not a demo ticket. Leave it alone.
- Any open pull request labeled `demo-example`, currently #30, #31, and #35, stays open and keeps its head branch. Never close it or delete its branch during a reset, even for `MARS-4`. To rebase those pull requests onto `main` before a demo, follow Pre-demo in [.cursor/skills/demo-reset/SKILL.md](../demo-reset/SKILL.md). A board reset does not run Pre-demo.

## Description source

Original descriptions live in `/cursor/stores/bc-7f1a60e0-ea46-4d78-9dca-57979f5bcd65/docs/features.md`. Each demo feature links its `MARS` key. Do not tick or untick those checkboxes during a reset.

The description to restore is that feature's sentence plus its Layers line:

1. Find the bullet whose link is that exact key.
2. The sentence is the prose after the em dash on that bullet.
3. The Layers line is the following `*Layers:*` line. Keep it on its own line under the sentence.

Match the key as a whole token. `MARS-1` is not `MARS-10` or `MARS-11`.

## For each story

1. Read the current issue and look up its phase in the table above.
   - Leave `MARS-3` in Done. Do not transition it, and do not change its assignee or description.
   - If the status differs, transition the issue to `21` In Progress for `MARS-1`, `MARS-2`, `MARS-4`, and `MARS-5`, or `11` To Do for `MARS-6` through `MARS-11`.
   - Set the assignee to Ben Karciauskas's accountId for `MARS-1`, `MARS-2`, `MARS-4`, and `MARS-5`. Clear it with `null` for `MARS-6` through `MARS-11`.
   - Restore the description from `features.md` for `MARS-4` through `MARS-11`. Leave the `MARS-1`, `MARS-2`, and `MARS-3` descriptions as they are. Leave the `marsbank-demo` label.
2. Check open pull requests in `bkarciauskas/marsbank` whose title or body names that `MARS` key as a whole token.
   - Skip any open pull request labeled `demo-example`, currently #30, #31, and #35. Leave it open and keep its head branch, even for `MARS-4`.
   - Close every other open pull request for that key without merging, and delete its head branch.
   - Do not touch merged pull requests or their branches, including #33 on `MARS-3`. Do not touch pull requests that do not name a `MARS` key.
3. Report the key, its restored status and assignee, and which pull requests were closed or kept. If none were open, say so.
