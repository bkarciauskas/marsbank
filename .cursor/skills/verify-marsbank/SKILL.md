---
name: verify-marsbank
description: Drive Mars Bank's web UI at a dedicated local port and prove login plus banking user paths (accounts, transfers, cards, activity) with Playwright screenshots, ARIA snapshots, and register API evidence.
---

# Verify Mars Bank

Project-local control skill for [Mars Bank](https://github.com/internalsphere/marsbank), a Next.js demo bank. Write for the next agent: launch an isolated instance, doctor it, drive a mapped user path, keep the proof, then tear down only what this run started.

Primary surface is the web UI. Secondary surfaces are the route handlers under `app/api/` (`/api/session`, `/api/register`, `/api/transfers`, `/api/cards`, `/api/reset`). Do not treat Vitest component tests as proof of the running app.

## Interview snapshot

- **Surface:** public site `/` and `/login`; signed-in desk at `/banking`, `/banking/accounts`, `/banking/cards`, `/banking/transfer`, `/banking/activity`, `/banking/reports`, `/banking/settings`.
- **Run:** from the repo root, `npm install` then `npm run dev`. README default is `http://localhost:3000`. Local ledger is in-memory and resets on process restart. **Restore shared demo** on Settings restores all six residents. No secrets are required for the local smoke path.
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
node .cursor/skills/verify-marsbank/scripts/drive.mjs transfer
node .cursor/skills/verify-marsbank/scripts/drive.mjs cards
node .cursor/skills/verify-marsbank/scripts/drive.mjs activity
```

Optional: `--resident cameron` (default is `aaron`, so login proves roster selection rather than the prefilled Cameron row). `--headed` opens a visible browser.

If you must drive by hand in Playwright, keep these selectors:

- Login roster: click the `label` that wraps `getByRole("radio", { name: /aaron/i })` — the radio itself is covered by the label (same names for cameron, ben, richard, robin, blake)
- Login submit: `getByRole("button", { name: "Enter Mars Bank" })`
- Banking home: `waitForURL("**/banking")` then `getByRole("heading", { level: 1, name: "Good evening, Aaron" })`
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
- `register.json` (and before/after variants on mutations) — `GET /api/register` using the session cookie
- `proof.json` — feature id, entry point, actions, observed values, artifact paths

Proof standards:

- Exercise the real user path (roster radio + **Enter Mars Bank**, sidebar/search/transfer controls). Do not set `marsbank-demo-session` by hand or POST `/api/session` as a substitute for login proof.
- Capture the action **and** the resulting state (login form, then the banking greeting; review, then **Tokens dispatched**).
- Verify side effects: after login, `/api/register` must return the chosen resident; after an own-account transfer, `acc-everyday.available` must drop by the sent amount.
- Mocks only at the product's existing boundary: the local in-memory ledger is the real local backend. Do not stub `/api/session` or `/api/transfers` during a UI proof.

## Cleanup

```bash
node .cursor/skills/verify-marsbank/scripts/cleanup.mjs
```

Stops the process group recorded in `instance.json` (and listeners on that port that belong to the run), then deletes `.run/` only after the port is free. If a listener survives, `instance.json` stays so a retry can stop the same run. It never deletes `evidence/`. After cleanup, confirm `ls .cursor/skills/verify-marsbank/evidence/<runId>/<feature>` still lists the screenshots and `proof.json`.

If a drive fails, run Cleanup before the next Launch so port 4317 is not stranded.

## Helpers

All scripts are executable Node ESM and are invoked from the repo root:

| Script | Purpose |
| --- | --- |
| `.cursor/skills/verify-marsbank/scripts/launch.mjs` | Start an isolated `next dev` and wait until `/login` is 200 |
| `.cursor/skills/verify-marsbank/scripts/doctor.mjs` | Read-only health check |
| `.cursor/skills/verify-marsbank/scripts/drive.mjs <feature>` | Playwright recipe for one mapped feature |
| `.cursor/skills/verify-marsbank/scripts/cleanup.mjs` | Tear down only this run; keep evidence |
| `.cursor/skills/verify-marsbank/scripts/lib.mjs` | Shared paths, instance file, HTTP wait |

## Feature map

Index and recipes: [features/README.md](features/README.md).

## Maintenance

When routes, accessible names, or demo residents change, update this skill and the feature map with `/maintain-verification-skill`.
