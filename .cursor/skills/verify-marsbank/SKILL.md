---
name: verify-marsbank
description: Drive Mars Bank's web UI at a dedicated local port and prove login plus banking user paths (accounts, transfers, cards, activity) with Playwright screenshots, ARIA snapshots, and register API evidence.
---

# Verify Mars Bank

Project-local control skill for [Mars Bank](https://github.com/internalsphere/marsbank), a Next.js demo bank. Write for the next agent: launch an isolated instance, doctor it, drive a mapped user path, keep the proof, then tear down only what this run started.

Primary surface is the web UI. Secondary surfaces are the route handlers under `app/api/` (`/api/session`, `/api/register`, `/api/transfers`, `/api/cards`, `/api/reset`). Do not treat Vitest component tests as proof of the running app.

## Start and prove

Start the app:

```bash
npm run app
```

That runs `scripts/start.sh`. It installs dependencies when `next` is missing, frees the port, and serves `http://127.0.0.1:3000` (`PORT=3021 npm run app` to use another port).

Prove the sign-in journey:

```bash
npm run test:e2e
```

`e2e/sign-in.mjs` starts its own server on `127.0.0.1:4173` (`MARSBANK_E2E_PORT` to override), picks Aaron on `/login`, enters Mars Bank, and opens Accounts. It uses installed Chrome. It does not attach to port 3000. A passing run prints `{"ok":true,...}`.

The rest of this skill is the screenshot harness on port 4317. Use it when a change needs saved screenshots, ARIA snapshots, or a register JSON proof. `npm run test:e2e` is enough for a sign-in or accounts change.

## Interview snapshot

- **Surface:** public site `/` and `/login`; signed-in desk at `/banking`, `/banking/accounts`, `/banking/cards`, `/banking/transfer`, `/banking/activity`, `/banking/reports`, `/banking/settings`.
- **Run:** from the repo root, `npm install` then `npm run app` (serves `http://127.0.0.1:3000`). Prove sign-in with `npm run test:e2e`. Local ledger is in-memory and resets on process restart. **Restore shared demo** on Settings restores all six residents. No secrets are required for the local smoke path.
- **Drive:** Playwright is already a repo dependency (`scripts/capture-desk.mjs` and `package.json`). Prefer role + accessible-name selectors already used in `app/**/*.test.*`.
- **Observe:** full-page screenshots, `ariaSnapshot()` text, and `/api/register` JSON after a session cookie exists.
- **Isolate:** start a dedicated `127.0.0.1:4317` instance (`MARSBANK_VERIFY_PORT` to override). Never attach to a `:3000` (or any other) process this run did not start. Isolation is process-local only: one Next process owns one in-memory ledger. Launch sets `MARSBANK_NEXT_DIST_DIR=.next-verify` so Next 16 will start beside a running `:3000`. Hosted Supabase is not used by `npm run dev`. This cloud image has `lsof`/`netstat` but not `ss`.

Demo roster (fictional; from `lib/fixtures.ts` / README):

| Resident | Email | Password | Member ID |
| --- | --- | --- | --- |
| Cameron (default) | `cameron@marsbank.mars` | `Olympus!2026` | `MB-104821` |
| Aaron | `aaron@marsbank.mars` | `Tharsis!2026` | `MB-110274` |
| Ben | `ben@marsbank.mars` | `Jezero!2026` | `MB-118903` |
| Richard | `richard@marsbank.mars` | `Valles!2026` | `MB-102447` |
| Robin | `robin@marsbank.mars` | `Hellas!2026` | `MB-125610` |
| Blake | `blake@marsbank.mars` | `Elysium!2026` | `MB-131082` |

## Launch

Run every command from the repository root.

```bash
npm install
npx playwright install chromium
node .cursor/skills/verify-marsbank/scripts/launch.mjs
```

`launch.mjs` starts `npm run dev -- --hostname 127.0.0.1 --port 4317` in its own process group, writes `.cursor/skills/verify-marsbank/.run/instance.json`, and sends Next stdio to `.cursor/skills/verify-marsbank/.run/next.log` as real file descriptors (not pipes) so the server stays up after the launcher exits. It also sets `NEXT_TELEMETRY_DISABLED=1`.

**Ready signal:** `GET http://127.0.0.1:4317/login` returns HTTP 200. The Next log also prints a `Ready` / `Local:` line. The script exits 0 only after the HTTP check.

**Teardown:** `node .cursor/skills/verify-marsbank/scripts/cleanup.mjs` (see Cleanup). Do not `pkill next` or kill by process name.

Override host/port with `MARSBANK_VERIFY_HOST` and `MARSBANK_VERIFY_PORT`. Launch refuses to start if `instance.json` still names a live pid, or if another process already owns the port.

## Doctor

Read-only health check. Run it after launch and again whenever the instance looks wrong.

```bash
node .cursor/skills/verify-marsbank/scripts/doctor.mjs
```

Pass means all of:

- `.run/instance.json` exists and its `pid` is alive
- `GET {baseUrl}/login` is 200 and the HTML contains `Enter Mars Bank` and `Demo resident`
- `GET {baseUrl}/api/register` without a session cookie is 401 with `Sign in to view a register`
- If `lsof` or `netstat` can see the port, its listeners must belong to this run (this image has no `ss`)

Fail → run Cleanup, then Launch again. Do not drive a failing instance.

## Drive

Use Playwright through the shipped harness. Prefer the helpers over ad-hoc scripts. Stable handles come from the app tests and `scripts/capture-desk.mjs`.

```bash
node .cursor/skills/verify-marsbank/scripts/drive.mjs login
node .cursor/skills/verify-marsbank/scripts/drive.mjs accounts
node .cursor/skills/verify-marsbank/scripts/drive.mjs balances
node .cursor/skills/verify-marsbank/scripts/drive.mjs transfer
node .cursor/skills/verify-marsbank/scripts/drive.mjs cards
node .cursor/skills/verify-marsbank/scripts/drive.mjs activity
```

Optional: `--resident cameron` (default is `aaron`, so login proves roster selection rather than the prefilled Cameron row). `--headed` opens a visible browser.

If you must drive by hand in Playwright, keep these selectors:

- Login roster: click the `label` that wraps `getByRole("radio", { name: /aaron/i })` — the radio itself is covered by the label (same names for cameron, ben, richard, robin, blake)
- Login submit: `getByRole("button", { name: "Enter Mars Bank" })`
- Banking home: `waitForURL("**/banking")` then wait for the heading `formatDaypartGreeting(firstName, hour)` produces from `page.evaluate(() => new Date().getHours())`. Retry that wait only if the hour rolls between the sample and the locator. Login proof records that sample as `proof.observed.heading` and `proof.observed.hour`. The login drive always records video and saves `03-login-path.webm` after the context closes, including failed runs.
- Sidebar: `getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Accounts" })` — also `Cards`, `Send`, `Position`, `Reports`
- Transfer: `getByRole("link", { name: /Make a transfer/i })` → `getByRole("button", { name: "Between my accounts" })` → `getByPlaceholder("0")` → `getByRole("button", { name: "Review route" })` → `getByRole("button", { name: "Send tokens" })` → heading `Tokens dispatched`
- Cards: `getByRole("button", { name: "Freeze card" })` / `Unfreeze card`
- Activity search: `getByRole("searchbox", { name: "Search transactions, accounts and payees" })` then submit `form.desk-search`
- Settings restore: `getByRole("button", { name: "Restore shared demo" })` then `Restore all registers`

Read the matching file under [features/](features/README.md) before driving. A proof that only opens `/banking` is incomplete when the map lists other entry points for that feature.

## Evidence

Proof lands in `.cursor/skills/verify-marsbank/evidence/<runId>/<feature>/` and **must survive Cleanup**. That directory is gitignored except `evidence/README.md`. Name it in the PR or chat; do not delete it.

Each drive writes:

- `01-*.png` / `02-*.png` — full-page screenshots of the action and the resulting state
- `01-*.aria.txt` / `02-*.aria.txt` — Playwright `ariaSnapshot()` of `body`
- `03-login-path.webm` / `03-balances.webm` — login and balances drives only. Always-on video, finalized when the context closes
- `register.json` (and before/after variants on mutations) — `GET /api/register` using the session cookie
- `proof.json` — feature id, entry point, actions, observed values (including `proof.observed.hour` on login), artifact paths

Proof standards:

- Exercise the real user path (roster radio + **Enter Mars Bank**, sidebar/search/transfer controls). Do not set `marsbank-demo-session` by hand or POST `/api/session` as a substitute for login proof.
- Capture the action **and** the resulting state (login form, then the banking greeting; review, then **Tokens dispatched**).
- Verify side effects: after login, `/api/register` must return the chosen resident; after an own-account transfer, `acc-everyday.available` must drop by the sent amount.
- Mocks only at the product's existing boundary: the local in-memory ledger is the real local backend. Do not stub `/api/session` or `/api/transfers` during a UI proof.

## PR evidence

Reviewers should see the change on github.com without reading code, so the only test that counts is a logged-out browser loading each image. Repo media embedded as `https://github.com/<owner>/<repo>/raw/<sha>/...` loads only when the repo is **public**: github.com redirects to `raw.githubusercontent.com`. On a private repo those URLs are 404 to anyone without a session, and they showed as broken icons even to a signed-in viewer on #11. For a private repo, drag and drop the PNGs and GIF into the PR description editor on github.com. That makes `user-attachments` uploads, which work on private repos, and it is also the only way to get inline video. GitHub strips `<video>` tags that point at repo files. A token cannot create user-attachments (HTTP 422). Ship motion as an animated GIF image and link the mp4.

```bash
node .cursor/skills/verify-marsbank/scripts/drive.mjs balances   # or any recipe that records video
node .cursor/skills/verify-marsbank/scripts/pr-evidence.mjs publish --feature <slug> \
  --before <evidence>/01-*.png --after <evidence>/02-*.png --video <evidence>/03-*.webm \
  --title "<what changed>" --append <checks.md>
# put the printed markdown file into the PR body, then:
node .cursor/skills/verify-marsbank/scripts/pr-evidence.mjs check --pr <number> --feature <slug> \
  --logged-out-screenshot <logged-out.png>
```

- `publish` copies the PNGs to `docs/verification/<slug>/`, converts the recording to `demo.mp4` and a `demo.gif` under 5 MB (it steps the width down until it fits), commits only those files, pushes the branch, and writes `pr-body.md` with URLs pinned to the commit SHA. Pinned URLs keep working after the branch is deleted.
- `check` reads the PR through `gh api` with `application/vnd.github.html+json` and loads every `<img src>` in `body_html` like a logged-out browser: plain HTTP, no cookies or token, every redirect followed. Each image must end in a 200 with PNG/GIF/JPEG/WebP bytes. The output lists every hop (for example `github.com 302 -> raw.githubusercontent.com 200`), so a failure names the host. The check also requires `<img>` tags for the slug's `before.png`, `after.png`, and `demo.gif`, and a 200 on the logged-out PR page. There is no fallback. Any miss exits 1. On a private repo it always exits 1, with one line telling you to drag and drop the files into the PR editor.
- `--logged-out-screenshot` saves a full-page screenshot of the real github.com PR page in a fresh browser with no session, and records which body images actually rendered (`naturalWidth > 0`).
- The check runs from your machine's network. A host that network blocks fails the check (for example `raw.githubusercontent.com ECONNRESET`). Fix the egress allowlist; do not work around it.
- Without Playwright's bundled browser, the scripts use installed Chrome. If Playwright's own ffmpeg is missing, link the system ffmpeg to the path in its error (`~/.cache/ms-playwright/ffmpeg-*/ffmpeg-linux`).

## Cleanup

```bash
node .cursor/skills/verify-marsbank/scripts/cleanup.mjs
```

Stops the process group recorded in `instance.json` (and listeners on that port that belong to the run), then deletes `.run/` and the verification-owned `.next-verify/` only after the port is free. If a listener survives, `instance.json` stays so a retry can stop the same run. It never deletes `evidence/`. Running Cleanup again removes stale `.next-verify/` even when no instance is recorded. After cleanup, confirm `ls .cursor/skills/verify-marsbank/evidence/<runId>/<feature>` still lists the screenshots and `proof.json`.

If a drive fails, run Cleanup before the next Launch so port 4317 is not stranded.

## Helpers

All scripts are executable Node ESM and are invoked from the repo root:

| Script | Purpose |
| --- | --- |
| `.cursor/skills/verify-marsbank/scripts/launch.mjs` | Start an isolated `next dev` and wait until `/login` is 200 |
| `.cursor/skills/verify-marsbank/scripts/doctor.mjs` | Read-only health check |
| `.cursor/skills/verify-marsbank/scripts/drive.mjs <feature>` | Playwright recipe for one mapped feature |
| `.cursor/skills/verify-marsbank/scripts/cleanup.mjs` | Tear down only this run; keep evidence |
| `.cursor/skills/verify-marsbank/scripts/pr-evidence.mjs publish\|check` | Commit before/after PNGs + GIF for a PR and prove a logged-out browser loads them |
| `.cursor/skills/verify-marsbank/scripts/lib.mjs` | Shared paths, instance file, HTTP wait |

## Feature map

Index and recipes: [features/README.md](features/README.md).

## Maintenance

When routes, accessible names, or demo residents change, update this skill and the feature map with `/maintain-verification-skill`.
