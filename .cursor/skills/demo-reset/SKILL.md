---
name: demo-reset
description: Restore the Mars Bank worktree after a pstack demo. Use only when a human types /demo-reset. Reverts the plant, tears down a verify instance, closes the demo pull request, and deletes its Cursor card. Never force-push or merge.
disable-model-invocation: true
---

# Reset the demo worktree

Work from the repository root.

1. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs revert`.
2. Require JSON `state` of `healthy`.
3. Run `node .cursor/skills/verify-marsbank/scripts/cleanup.mjs` even when no instance exists.
4. Run `git status` and report leftover files from `/demo-fix`. Leave them unless the human asks to drop them.
5. In `bkarciauskas/marsbank`, close every open pull request whose title or body names a `MARS` key, without merging, and delete its head branch. GitHub keeps the closed pull request. Do not touch a merged pull request.
6. Delete the Cursor tracker card that links that pull request. Leave cards whose pull requests merged.

Do not run `git reset --hard`. Do not force-push. Do not merge. Do not delete the progress canvas or `verify-marsbank` evidence.
