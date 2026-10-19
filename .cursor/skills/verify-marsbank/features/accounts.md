# Accounts

Accounts is the token register: every deposit, offset, credit line, and habitat loan on shared columns, plus a per-account movement page.

## Sub-features

- `accounts-register` lists offset accounts separately from habitat debt and expedition credit.
- `accounts-open` opens one account from a register row.
- `accounts-detail` shows available / remaining figures and **Account movement**.
- `accounts-search` narrows the register from the desk search scoped to Accounts.
- `accounts-empty` explains when no account matches the query.
- `accounts-hide-balances` masks every figure (rows, totals, register position) behind **Hide balances** and brings them back with **Show balances**.

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
- **Open Sol Account.** Choose the **Sol Account** row. Run `page.getByRole("link", { name: /Sol Account/i }).first().click()`. URL ends with `/banking/accounts/acc-everyday`. The heading is `Sol Account` and a second heading reads `Account movement`.
- **Account-scoped search.** From the desk, set search scope to **Accounts** (`getByRole("combobox")` / `select` in `form.desk-search`), type `long horizon`, and submit. URL is `/banking/accounts?q=long%20horizon` and only **Long Horizon Reserve** remains.
- **Empty search.** Submit `phobos shipyard` with Accounts scope. Copy includes `No accounts match`.
- **Hide balances.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs balances`. It clicks `getByRole("button", { name: "Hide balances" })`, waits for `Show balances` (`aria-pressed="true"`), and fails if any `.account-value strong` still contains a digit. The heading stays `Token register`. It keeps `01-balances-shown.png`, `02-balances-hidden.png`, and `03-balances.webm` under `evidence/<runId>/balances/`.
- **Proof.** Keep `01-token-register.png`, `01-token-register.aria.txt`, `02-sol-account.png`, `02-sol-account.aria.txt`, and `proof.json` under `evidence/<runId>/accounts/`.

## Gotchas

- Desktop and mobile both expose an **Accounts** link. Scope clicks to `navigation` named `Banking` so the hidden mobile tab bar is not targeted.
- Loan rows are not spendable. Do not treat remaining principal as available tokens.
- Account ids are stable fixtures (`acc-everyday`, `acc-reserve`, `acc-offset`, `acc-credit`, `acc-habitat-loan`) but proof should still follow the visible name.
- Home (`/banking`) also lists accounts. Opening only the home ledger does not prove the token register page.
