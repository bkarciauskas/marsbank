# Mars Bank verification map

This directory is the maintained source for verifying the user-facing behavior of Mars Bank. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch Mars Bank with `node .cursor/skills/verify-marsbank/scripts/launch.mjs` so it listens on `http://127.0.0.1:4317` (or `MARSBANK_VERIFY_PORT`).
- Run `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` and require HTTP 200 on `/login` plus 401 on unauthenticated `/api/register`.
- Use the in-memory ledger of **this** Next process. Do not drive `http://localhost:3000` unless this run started it.
- Prefer the shipped Playwright harness: `node .cursor/skills/verify-marsbank/scripts/drive.mjs <feature>`.
- Never drive an instance that was not started by this verification run.

## Driving conventions

- Start every recipe from a freshly doctored instance unless its preconditions say otherwise.
- Prefer ARIA roles and accessible names over CSS selectors or DOM position.
- Treat every command as literal. Keep quoted names and flags unchanged.
- Default harness resident is Aaron (`--resident cameron` to use the prefilled row).
- After a mutation, restore with **Restore shared demo** → **Restore all registers** on `/banking/settings` if a later feature needs seed balances. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes an ARIA snapshot and a screenshot with Mars Bank identity visible (wordmark, greeting, or page heading).
- Mutation proof includes a second view: `GET /api/register` JSON and a visible success state.
- Record the feature ID and entry point used with every artifact under `.cursor/skills/verify-marsbank/evidence/<runId>/<feature>/`.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with Playwright` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Login](./login.md) covers the public Enter path, demo roster, banking home, and logout.
- [Accounts](./accounts.md) covers the token register, account detail, and account-scoped search.
- [Transfer](./transfer.md) covers own-account and PayID sends through review to posted.
- [Cards](./cards.md) covers the card desk and freeze / unfreeze.
- [Activity](./activity.md) covers the movement ledger and transaction search.
