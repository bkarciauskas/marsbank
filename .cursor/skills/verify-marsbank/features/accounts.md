# Accounts

Accounts is the token register: every deposit, offset, credit line, and habitat loan on shared columns, plus a per-account movement page.

## Sub-features

- `accounts-register` lists offset accounts separately from habitat debt and expedition credit.
- `accounts-open` opens one account from a register row.
- `accounts-detail` shows one headline figure, `Available`, `Remaining`, or `Owing`, plus **Account movement**.
- `accounts-offset-planner` is the what-if on the habitat loan. **Lump-sum payment** and **Move into offset** change the plan only. **Make a repayment** opens Send with that loan selected.
- `accounts-search` narrows the register from the desk search scoped to Accounts.
- `accounts-empty` explains when no account matches the query.
- `accounts-hide-balances` masks row figures and the register-position figures behind **Hide balances**, and brings them back with **Show balances**. The token register has no totals strip. The position panel starts collapsed.

## How to get to it (user POV)

- Choose **Accounts** in the Banking sidebar (or the mobile **Accounts** tab).
- Open `/banking/accounts` while signed in.
- From the banking home ledger, choose an account name such as **Sol Account**.
- Search with scope **Accounts** and a query, which routes to `/banking/accounts?q=…`.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- A demo session exists (drive login first, or use `drive.mjs accounts`, which logs in as Aaron).
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open register.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs accounts` or choose the sidebar **Accounts** link: `page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Accounts" }).click()`. URL is `/banking/accounts`. Headings are `Token register`, `Offset accounts`, and `Habitat debt and expedition credit`.
- **See seed rows.** The register includes links named like `Sol Account`, `Long Horizon Reserve`, `Habitat Offset`, `Expedition Credit`, and the resident's habitat loan (Aaron: `Tharsis Rise Habitat`).
- **Open Sol Account.** Choose the **Sol Account** row. Run `page.getByRole("link", { name: /Sol Account/i }).first().click()`. URL ends with `/banking/accounts/acc-everyday`. The heading is `Sol Account` and a second heading reads `Account movement`. The figure label is `Available`. Choose **Open habitat loan**.
- **Read the offset planner.** The loan heading is the habitat name (Aaron: `Tharsis Rise Habitat`) and the figure label is `Remaining`. The region named `Offset planner` has **Make a repayment**, pointing at `/banking/transfer?from=acc-everyday&to=acc-habitat-loan`. Fill `10000` in **Lump-sum payment**. The link reads `Repay 10,000 tokens` and adds `&amount=10000`. Fill `12.5` in **Move into offset**. The alert reads `Enter whole tokens, such as 250,000.` The page says nothing moves until you send a repayment. `drive.mjs accounts` keeps `03-offset-planner.png` with the other account shots.
- **Account-scoped search.** From the desk, set search scope to **Accounts** (`getByRole("combobox")` / `select` in `form.desk-search`), type `long horizon`, and submit. URL is `/banking/accounts?q=long%20horizon` and only **Long Horizon Reserve** remains.
- **Empty search.** Submit `phobos shipyard` with Accounts scope. Copy includes `No accounts match`.
- **Hide balances.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs balances`. It opens **Show register position**, clicks **Hide balances**, and fails if a row figure or the position panel still contains a digit. **Show balances** must have `aria-pressed="true"`. It then clicks **Show balances** and fails if the first row figure has no digit. The heading stays `Token register`. It keeps `01-balances-shown.png`, `02-balances-hidden.png`, and `03-balances.webm` under `evidence/<runId>/balances/`.
- **Proof.** Keep `01-token-register.png`, `02-sol-account.png`, `03-offset-planner.png`, the matching `.aria.txt` files, and `proof.json` under `evidence/<runId>/accounts/`.

## Gotchas

- Desktop and mobile both expose an **Accounts** link. Scope clicks to `navigation` named `Banking` so the hidden mobile tab bar is not targeted.
- Loan rows are not spendable. Do not treat remaining principal as available tokens.
- Account ids are stable fixtures (`acc-everyday`, `acc-reserve`, `acc-offset`, `acc-credit`, `acc-habitat-loan`) but proof should still follow the visible name.
- Home (`/banking`) also lists accounts. Opening only the home ledger does not prove the token register page.
