# Mars Bank

A demo bank built for people on Mars.

This repo is an [internalsphere](https://github.com/internalsphere/internal-app-orchestrator) app. Mars Bank uses synthetic account data and model tokens to demonstrate a complete retail banking experience.

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
card controls, transaction history, and transfers in model tokens. A configured Vercel deployment
uses the integration-managed Supabase database so transfers between residents update both shared
registers. Local development uses an in-memory shared ledger that resets when the server restarts.
**Restore shared demo** restores all six original balances.

Ship changes on a branch and open a PR. Preview deploys land on the PR; production deploys on merge to `main`.

Laptop setup, access, and FAQs live in [QUICKSTART.md](./QUICKSTART.md). The full internalsphere guide is in [Notion](https://www.notion.so/cursorai/internalsphere-348da74ef0458184af80e67adbcef6b7).
