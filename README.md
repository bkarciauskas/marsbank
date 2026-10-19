# Mars Bank

A demo bank built for people on Mars.

Mars Bank is a Next.js demo app. It uses synthetic account data and model tokens to demonstrate a complete retail banking experience.

## Get started

1. Clone this repo.
2. Run once:

   ```bash
   sh scripts/setup-repo.sh
   ```

3. Confirm hooks are on: `git config core.hooksPath` should print `.githooks`.
4. Install and run the app:

   ```bash
   npm install
   npm run dev
   ```

Open `http://localhost:3000`. Pick one of the six fictional residents on the
login page to prefill their demo credentials.

The demo includes one expensive property loan, offset accounts against that loan, a credit card,
card controls, transaction history, and transfers in model tokens. When `DB_POSTGRES_URL` is set,
the app stores the shared ledger in Postgres so transfers between residents update both shared
registers. Local development uses an in-memory shared ledger that resets when the server restarts.
**Restore shared demo** restores all six original balances.

Ship changes on a branch and open a PR. The `CI` workflow (`.github/workflows/ci.yml`) runs typecheck, lint, and test on every pull request and on pushes to `main`.

## Required checks

The `CI` workflow runs on every pull request. Require these check names in the `main` branch ruleset before merge:

- `typecheck` — `npm run typecheck`
- `lint` — `npm run lint`
- `test` — `npm run test`

A workflow file cannot mark its own checks required. Set the three names above on the repository ruleset.

More setup notes live in [QUICKSTART.md](./QUICKSTART.md).
