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
- The board has no sprints. Columns are To Do, In Progress, and Done.
- Pull requests live in `github.com/bkarciauskas/marsbank`.

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

1. Read the current issue. If it is not already To Do, transition it to To Do. Restore the description from `features.md`. Leave the `marsbank-demo` label.
2. Find open pull requests in `bkarciauskas/marsbank` whose title or body names that `MARS` key. Close each without merging and delete its head branch. Do not touch pull requests that do not name a `MARS` key. Do not touch merged pull requests.
3. Tell the user the key, that it is To Do, and which pull requests were closed. If none were open, say so.
