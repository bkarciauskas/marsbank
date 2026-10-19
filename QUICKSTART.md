# Quickstart

Mars Bank is a demo bank with six fictional residents and whole model tokens. See [README.md](./README.md) for what the app does.

## First time on this repo

1. Clone the repo.
2. Run once per repo:
   ```bash
   sh scripts/setup-repo.sh
   ```
3. Verify git hooks are active:
   ```bash
   git config core.hooksPath  # should print: .githooks
   ```
4. Install and run the app:
   ```bash
   npm install
   npm run dev
   ```

Open `http://localhost:3000` and pick a resident on the login page. Local development uses an in-memory ledger that resets when the server restarts.

## How to ship a change

1. Branch off `main`, commit, push.
2. Open a PR. The `CI` workflow (`.github/workflows/ci.yml`) runs typecheck, lint, and tests.
3. Merge when the required checks are green.

Before pushing, run the same checks locally:

```bash
npm run typecheck
npm run lint
npm run test
```

## Required checks

These are the jobs in `.github/workflows/ci.yml`. Require them on the `main` branch ruleset:

- `typecheck` — `npm run typecheck`
- `lint` — `npm run lint`
- `test` — `npm run test`

## Secrets

Do not commit plaintext `.env` files. The pre-commit hook blocks them; only `.env.example`, `.env.sample`, and `.env.template` may be tracked.

## Important guardrails

- Do not bypass hooks with `--no-verify`.
