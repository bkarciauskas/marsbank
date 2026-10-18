---
name: pull-and-start
description: Pull the latest Mars Bank from GitHub and start the dev server on its pinned port 3021. Use when a human types /pull-and-start or asks to pull the latest and start the app.
disable-model-invocation: true
---

# Pull the latest and start Mars Bank

Run every command from the repository root. Both steps need network or port access, so run them outside the sandbox.

## 1. Pull

```bash
git branch --show-current
git pull
```

- `origin` is GitHub (`bkarciauskas/marsbank`) and is the only remote. Do not add or repoint remotes; the old Cursor Origin copy was deleted.
- Never stash, reset, or discard local changes to make the pull succeed. If git refuses because a local change would be overwritten, stop and report the conflicting files.
- If not on `main`, say so and pull the current branch anyway; do not switch branches unasked.
- If the pulled commits changed dependencies, run `npm install`. Check with `git diff ORIG_HEAD HEAD -- package-lock.json package.json`; a lockfile change or an edit under `dependencies` / `devDependencies` counts, a `scripts` edit does not. `scripts/start.sh` only installs when `node_modules/.bin/next` is missing, so it will not pick up new dependencies on its own.

## 2. Start

```bash
PORT=3021 sh scripts/start.sh
```

- Port 3021 is Mars Bank's pinned demo port. Do not fall back to 3000 or hop ports on conflict.
- `start.sh` kills whatever is listening on 3021 first. That is intended (it restarts a stale Mars Bank), but if `lsof -nP -iTCP:3021 -sTCP:LISTEN` shows a non-Node process, ask before running it.
- Run it in the background; it does not exit. Ready when the output shows `✓ Ready`, then confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:3021/login` returns `200`.
- The ledger is in memory, so every restart resets demo data.

## 3. Report

Tell the user, in a sentence or two:

- The commit now at `HEAD` (`git log -1 --oneline`), or that it was already up to date.
- Whether `npm install` ran.
- The URLs from the Next output: `http://localhost:3021` and the `Network:` LAN address.

Phones and other devices on the LAN can load the Network URL, but Next dev blocks its dev assets for origins other than `localhost`, so client navigation may not work there.
