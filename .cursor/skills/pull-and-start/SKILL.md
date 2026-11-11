---
name: pull-and-start
description: Return to main, delete branches whose PRs merged, pull the latest Mars Bank from GitHub, and start the dev server on its pinned port 3021. Use when a human types /pull-and-start or asks to pull the latest and start the app.
disable-model-invocation: true
---

# Pull the latest and start Mars Bank

Run every command from the repository root. The git, `gh`, and start steps need network or port access, so run them outside the sandbox.

## 1. Return to main and delete merged branches

```bash
git fetch --prune origin
git branch --show-current
git for-each-ref --format='%(refname:short)' refs/heads
gh pr list --repo bkarciauskas/marsbank --head <branch> --state merged --json number --jq length
```

- `origin` is GitHub (`bkarciauskas/marsbank`) and is the only remote. Do not add or repoint remotes; the old Cursor Origin copy was deleted.
- A local branch is merged when the `gh pr list` check above prints `1` or more. PRs are squash-merged, so `git branch -d` and `git branch --merged` call these branches unmerged. Trust the PR state instead.
- If the current branch is merged, run `git switch main`. Uncommitted changes come along. If git refuses because a change would be overwritten, stop and report the files.
- Delete every merged local branch with `git branch -D <branch>`. If `git ls-remote --heads origin <branch>` still lists it, also run `git push origin --delete <branch>`. The merged PR keeps a **Restore branch** button.
- Skip a branch that is checked out in another worktree (`git worktree list`) and name it in the report.
- Leave `main`, branches with an open PR, and branches with no PR alone, and list them in the report. If the current branch is one of these, stay on it and pull it.

## 2. Pull

```bash
git pull --ff-only
```

- Never stash or discard uncommitted changes to make the pull succeed. If git refuses because a local change would be overwritten, stop and report the conflicting files.
- If `main` cannot fast-forward, list its own commits with `git log --oneline --no-merges origin/main..main`. Check each one with `gh pr list --repo bkarciauskas/marsbank --state merged --search <sha> --json number`. If every commit belongs to a merged PR, that work already landed through a squash merge, so run `git reset --keep origin/main`. `--keep` keeps uncommitted changes and refuses when one would be overwritten. If any commit has no merged PR, stop and report it.
- If the pulled commits changed dependencies, run `npm install`. Check with `git diff ORIG_HEAD HEAD -- package-lock.json package.json`; a lockfile change or an edit under `dependencies` / `devDependencies` counts, a `scripts` edit does not. `scripts/start.sh` only installs when `node_modules/.bin/next` is missing, so it will not pick up new dependencies on its own.

## 3. Start

```bash
PORT=3021 sh scripts/start.sh
```

- Port 3021 is Mars Bank's pinned demo port. Do not fall back to 3000 or hop ports on conflict.
- `start.sh` kills whatever is listening on 3021 first. That is intended (it restarts a stale Mars Bank), but if `lsof -nP -iTCP:3021 -sTCP:LISTEN` shows a non-Node process, ask before running it.
- Run it in the background; it does not exit. Ready when the output shows `✓ Ready`, then confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:3021/login` returns `200`.
- The ledger is in memory, so every restart resets demo data.

## 4. Open in the Browser

Once `/login` returns 200, open `http://localhost:3021` in Cursor's Browser with the `cursor-ide-browser` `browser_navigate` tool, passing `position: "active"` so the tab is visible. Reuse an existing Mars Bank tab if `browser_tabs` lists one; otherwise set `newTab: true`.

Always use `localhost`, never the `Network:` address.

## 5. Report

Tell the user, in a sentence or two:

- The branch you ended on, the branches you deleted, and any you left alone with the reason.
- The commit now at `HEAD` (`git log -1 --oneline`), or that it was already up to date.
- Whether `npm install` ran.
- The URLs from the Next output: `http://localhost:3021` and the `Network:` LAN address.

Phones and other devices on the LAN can load the Network URL, but Next dev blocks its dev assets for origins other than `localhost`, so client navigation may not work there.
