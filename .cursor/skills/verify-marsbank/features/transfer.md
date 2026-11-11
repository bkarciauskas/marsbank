# Transfer

Transfer lets a signed-in resident move whole tokens between their own register accounts or to a Cursor / PayID identity, after an explicit review step.

## Sub-features

- `transfer-open` opens the send desk from home or the sidebar.
- `transfer-own` reviews and posts a move between the resident's accounts.
- `transfer-payid` reviews and posts a send to a suggested identity such as `@cursor`.
- `transfer-validate` blocks same-account, empty amount, invalid PayID, and a PayID amount past the sol limit with an alert.
- `transfer-step-up` holds a PayID send above 50,000 tokens until the review checkbox is checked. 50,000 tokens does not ask.
- `transfer-posted` shows **Tokens dispatched** and updates `/api/register`.

## How to get to it (user POV)

- Choose **Make a transfer** on `/banking`.
- Choose **Send** in the Banking sidebar or mobile tab bar.
- Open `/banking/transfer` or `/banking/transfer?from=acc-everyday` from an account's **Send tokens** action.
- After a successful send, choose **Plot another route** to return to the form.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). Seed Sol Account has far more than 10,000 tokens.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open send.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs transfer` or choose **Make a transfer**: `page.getByRole("link", { name: /Make a transfer/i }).click()`. Heading is `Send tokens`.
- **Own-account route.** Choose **Between my accounts**. Run `page.getByRole("button", { name: "Between my accounts" }).click()`. Default source is **Sol Account**; default destination is the habitat loan.
- **Collect.** Fill `10000` in the amount field (`getByPlaceholder("0")`) and `Verification repayment` in `getByPlaceholder("Optional note")`. Choose **Review route**.
- **Review.** Copy includes `10,000 tokens` and the habitat name (Aaron: `Tharsis Rise Habitat`; Cameron: `Olympus Arc Habitat`).
- **Post.** Choose **Send tokens**. Run `page.getByRole("button", { name: "Send tokens" }).click()`. Heading `Tokens dispatched` appears and the body says the amount moved from **Sol Account** to the habitat.
- **Confirm side effect.** `GET /api/register` shows `acc-everyday.available` decreased by `10000` versus the pre-transfer register.
- **PayID path (optional second pass).** Reload `/banking/transfer`, leave **Cursor or PayID** pressed, fill `@cursor` in `Recipient identity` (`getByPlaceholder("@name or name@domain")`), amount `2500`, review, send. Success copy includes `Cursor (@cursor)`.
- **Step-up.** On a fresh collect step, leave **Cursor or PayID** pressed, fill `@cursor` and `60000`, and choose **Review route**. The checkbox reads `I confirm sending 60,000 tokens to Cursor.` **Send tokens** stays disabled until that box is checked.
- **Sol limit.** On a fresh collect step, fill `@cursor` and `250001`, then choose **Review route**. The alert reads `That send passes your 250,000 tokens PayID limit for this sol. Lower the amount or send next sol.` The form stays on the collect step.
- **Proof.** Keep review and dispatched screenshots plus `01-register-before.json` and `02-register-after.json` under `evidence/<runId>/transfer/`.

## Gotchas

- Amounts are whole tokens. A blank or zero amount stays on the collect step with `Enter at least one whole token.`
- The destination toggle is two `aria-pressed` buttons, not radios. **Cursor or PayID** is the default; own-account proof must press **Between my accounts**.
- The source account button's accessible name includes the live balance (`Sol Account · 1,000,096,410 tokens available` for Aaron at seed). Match on `/Sol Account/`, not a hard-coded balance.
- The destination account button's accessible name is the account name and number (`Tharsis Rise Habitat · 7611 3088` for Aaron). It does not include the token balance.
- Own-account default destination is the habitat **loan**, which is what the component tests post. That is a real repayment, not a bug.
- Transfers mutate this process's in-memory ledger (and would mutate hosted Supabase in a deployed preview). Restore from Settings if a later feature needs seed balances.
- Do not treat a Vitest `TransferForm` test as this feature's proof.
