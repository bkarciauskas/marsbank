# Transfer

Transfer lets a signed-in resident move whole tokens between their own register accounts or to a Cursor / PayID identity, after an explicit review step.

## Sub-features

- `transfer-open` opens the send desk from home or the sidebar.
- `transfer-allowance` shows tokens sent this UTC sol against the 250,000 PayID limit, with the 50,000 step-up line marked on the bar.
- `transfer-prefill` opens the form from `to`, `payid`, `amount`, and `note` query params beside `from`.
- `transfer-own` reviews and posts a move between the resident's accounts.
- `transfer-payid` reviews and posts a send to a suggested identity such as `@cursor`.
- `transfer-validate` blocks same-account, empty amount, and invalid PayID with an alert.
- `transfer-posted` shows **Tokens dispatched** and updates `/api/register`.

## How to get to it (user POV)

- Choose **Make a transfer** on `/banking`.
- Choose **Send** in the Banking sidebar or mobile tab bar.
- Open `/banking/transfer` or `/banking/transfer?from=acc-everyday` from an account's **Send tokens** action.
- Open `/banking/transfer?from=acc-everyday&payid=@cursor&amount=2500&note=Greenhouse%20share` for a filled PayID route.
- Open `/banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=10000&note=Habitat%20levy` for a filled own-account route.
- After a successful send, choose **Plot another route** to return to the form.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). Seed Sol Account has far more than 10,000 tokens.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open send.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs transfer` or choose **Make a transfer**: `page.getByRole("link", { name: /Make a transfer/i }).click()`. Heading is `Send tokens`. The meter `PayID tokens sent this sol` is on the page, with heading `Today's PayID limit` and the line `Step-up above 50,000 tokens`.
- **Allowance.** Before a PayID send the meter `aria-valuenow` is `0` and `aria-valuemax` is `250000`. After sending 2,500 to `@cursor`, the same meter reads `2500` and the page says `2,500 of 250,000 tokens used`. An own-account send leaves the meter unchanged.
- **Prefill.** `page.goto(baseUrl + "/banking/transfer?from=acc-reserve&payid=@cursor&amount=2500&note=Greenhouse%20share")` shows `@cursor` in `Recipient identity`, `2500` in the amount field, `Greenhouse share` in `Optional note`, and a source button matching `/Long Horizon Reserve/`. `page.goto(baseUrl + "/banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=10000&note=Habitat%20levy")` presses **Between my accounts** and shows the habitat as destination.
- **Own-account route.** Choose **Between my accounts**. Run `page.getByRole("button", { name: "Between my accounts" }).click()`. Default source is **Sol Account**; default destination is the habitat loan.
- **Collect.** Fill `10000` in the amount field (`getByPlaceholder("0")`) and `Verification repayment` in `getByPlaceholder("Optional note")`. Choose **Review route**.
- **Review.** Copy includes `10,000 tokens` and the habitat name (Aaron: `Tharsis Rise Habitat`; Cameron: `Olympus Arc Habitat`).
- **Post.** Choose **Send tokens**. Run `page.getByRole("button", { name: "Send tokens" }).click()`. Heading `Tokens dispatched` appears and the body says the amount moved from **Sol Account** to the habitat.
- **Confirm side effect.** `GET /api/register` shows `acc-everyday.available` decreased by `10000` versus the pre-transfer register.
- **PayID path (optional second pass).** Reload `/banking/transfer`, leave **Cursor or PayID** pressed, fill `@cursor` in `Recipient identity` (`getByPlaceholder("@name or name@domain")`), amount `2500`, review, send. Success copy includes `Cursor (@cursor)`.
- **Proof.** Keep review and dispatched screenshots plus `01-register-before.json` and `02-register-after.json` under `evidence/<runId>/transfer/`.

## Gotchas

- Amounts are whole tokens. A blank or zero amount stays on the collect step with `Enter at least one whole token.`
- The destination toggle is two `aria-pressed` buttons, not radios. **Cursor or PayID** is the default; own-account proof must press **Between my accounts**.
- Source and destination use `SurveySelect` buttons whose accessible name includes the live balance (`Sol Account · 1,000,096,410 tokens available` for Aaron at seed). Match on `/Sol Account/`, not a hard-coded balance.
- Own-account default destination is the habitat **loan**, which is what the component tests post. That is a real repayment, not a bug.
- Transfers mutate this process's in-memory ledger (and would mutate hosted Supabase in a deployed preview). Restore from Settings if a later feature needs seed balances.
- Do not treat a Vitest `TransferForm` test as this feature's proof.
- The meter counts PayID debits in the current UTC sol. Own-account moves do not advance it. Seed activity is on earlier sols, so a fresh register reads 0.
- `payid` selects **Cursor or PayID** even when `to` is also present. `to` alone selects **Between my accounts**. An amount that is not a whole token is left blank. Notes longer than 60 characters are cut to 60.
