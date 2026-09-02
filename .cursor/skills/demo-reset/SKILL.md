---
name: demo-reset
description: Restore the Mars Bank worktree after a pstack demo. Use only when a human types /demo-reset. Reverts the plant and tears down a verify instance. Never force-push or merge.
disable-model-invocation: true
---

# Reset the demo worktree

Work from the repository root.

1. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs revert`.
2. Require JSON `state` of `healthy`.
3. Run `node .cursor/skills/verify-marsbank/scripts/cleanup.mjs` even when no instance exists.
4. Run `git status` and report leftover files from `/demo-fix`. Leave them unless the human asks to drop them.

Do not run `git reset --hard`. Do not force-push. Do not merge. Do not delete the progress canvas or `verify-marsbank` evidence.
