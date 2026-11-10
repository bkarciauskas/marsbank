---
name: transfer-ledger-verification
description: Formal verification of Mars Bank transfers (TLA+ model of both ledger repositories, the route and the transfer form, plus a bounded-exhaustive check of the real ledger step). Use when a change touches lib/ledger.ts, lib/shared-ledger.ts, lib/server/ledger-repository.ts, app/api/transfers/route.ts, lib/store.tsx postTransfer, or components/banking/transfer-form.tsx, or when asked to run, read, or update the transfer verification.
---

# Transfer ledger verification

Everything lives in `verification/transfer-ledger/`:

| File | What it is |
| --- | --- |
| `TransferLedger.tla` | The model. Header comment maps every action to real code. |
| `MC.tla` | Bounded instances: seeds and the sends that race. |
| `check.sh` | Runs every scenario and the step-contract test; compares to the baseline below. |
| `step-contract.test.ts` | Runs the real `applySharedTransfer` on every boundary-value combination; checks it does what the model's `Apply` says. Also runs in `npm run test`. |
| `covered-files.txt` | Files the verification describes. |
| `sync-commit` | Commit at which the verification was last confirmed to match those files. |

Tool: TLC from tla2tools.jar v1.7.4 (sha256 pinned in `check.sh`, downloaded to `verification/transfer-ledger/.tools/` on first run). Needs Java 11+ and network access to github.com for that one download. Full run takes about 70 seconds on 8 cores.

## Properties (each a promise to a resident)

| Property | Plain sentence | Harm if broken |
| --- | --- | --- |
| `NoOverdraw` | No Sol Account goes below zero and no Expedition Credit goes past its limit. | Tokens spent that the resident never had. |
| `TokensConserved` | A transfer moves tokens and never creates or destroys them: the sum of `registerPosition().net` over residents, plus tokens sent to non-resident PayIDs, stays at what `resetAll` seeded. | Residents lose tokens, or the bank prints them. |
| `RequestAppliedOnce` | A `requestId` moves tokens at most once. | A repeated POST pays twice. |
| `SolLimitHeld` | PayID tokens that actually left a resident this sol stay within `SOL_SEND_LIMIT`. | A hijacked session drains past the limit. |
| `EachSendPostsOnce` | One confirmed "Send tokens" moves tokens at most once, even after "Try sending again". | The resident pays twice for one send. |

## Baseline (what `check.sh` must print)

| Scenario | Expected |
| --- | --- |
| `baseline-contention-postgres`, `baseline-contention-memory`, `baseline-crossing-postgres`, `baseline-crossing-memory`, `baseline-reset-postgres` | pass |
| `finding-retry-postgres`, `finding-retry-memory` | `EachSendPostsOnce` violated (finding 1) |
| `finding-overpay-memory` | `TokensConserved` violated (finding 2) |
| `reference-retry-same-request-id-postgres` | pass (shows what fixes finding 1) |
| `broken-no-funds-check` | `NoOverdraw` violated |
| `broken-no-row-lock-conservation` | `TokensConserved` violated |
| `broken-no-row-lock-sol-limit`, `broken-no-sol-check` | `SolLimitHeld` violated |
| `broken-no-recipient-credit` | `TokensConserved` violated |
| `broken-no-request-claim`, `broken-no-processed-check` | `RequestAppliedOnce` violated |
| step-contract (vitest) | 3 tests pass |

`check.sh` exits 0 exactly when every row matches. The `broken-*` rows prove each property can fail: each flips one switch that removes a real check.

### Findings (open; never weaken a property or drop a scenario to make them pass)

1. **A retried send can pay twice.** Steps: the resident presses "Send tokens"; `postTransfer` in `lib/store.tsx` posts with `requestId: crypto.randomUUID()`; the fetch rejects (connection drop or timeout) while `PostgresLedgerRepository.transfer` (or the memory one) is still running, so the form shows "The shared register could not be reached. Try sending again."; the resident presses "Send tokens" again; `postTransfer` mints a new `requestId`; both requests commit; Ben is paid twice. The server's `requestId` check cannot help because the IDs differ. Fix direction: keep one `requestId` per confirmed review step and reuse it on retry (`reference-retry-same-request-id-postgres` passes with that change).
2. **Overpaying a card or habitat loan destroys tokens.** Steps: Aaron owes 2 on Expedition Credit; he moves 3 from Sol Account to Expedition Credit; `applyTransfer` debits 3 through `debit()`, and `credit()` sets `owed = Math.max(0, owed - 3) = 0`; 1 token is gone. Same for `acc-habitat-loan` (`remaining`). The transfer form does not stop it. `step-contract.test.ts` pins the exact loss in `knownOverpayLoss`.

## 1. Does a change touch verified code?

```bash
bash verification/transfer-ledger/check.sh --drift
```

It diffs `covered-files.txt` against `sync-commit`, working tree included. Inside those files, these are the verified functions (anything else in them, such as `updateCardStatus` or `getRegister`, is outside the model):

- `lib/ledger.ts`: `applyTransfer`, `applyPayIdTransfer`, `applyIncomingResidentTransfer`, `debit`, `credit`, `sentThisSol`, `solSendRemaining`, `registerPosition`, `SOL_SEND_LIMIT`
- `lib/shared-ledger.ts`: `applySharedTransfer`
- `lib/money.ts`: `tokens`, `addTokens`, `subtractTokens`
- `lib/domain.ts`: `Account`, `BankSnapshot`, `HostedTransferCommand`, `TransferResult`
- `lib/server/ledger-repository.ts`: `recipientSlug`, `MemoryLedgerRepository.transfer` / `exclusive` / `resetAll`, `PostgresLedgerRepository.transfer` / `resetAll`
- `lib/server/request.ts`: `parseTransfer` (passes `requestId` through)
- `app/api/transfers/route.ts`: `POST`
- `lib/store.tsx`: `postTransfer`
- `components/banking/transfer-form.tsx`: `post`, the `network` message
- `migrations/001_shared_registers.sql`: primary keys of `marsbank_registers` and `marsbank_transfer_requests`

No diff in those functions: nothing to do. A diff: continue.

## 2. Run the check

```bash
npm run verify:transfer-ledger
# or one group: bash verification/transfer-ledger/check.sh baseline
```

Each scenario's TLC output, with the counterexample trace when a property fails, is in `verification/transfer-ledger/out/<scenario>.txt`; the generated config is beside it as `<scenario>.cfg`. Read traces with the pstack `/statechart` skill. Every state names the action taken (`ClientPost`, `PgClaim`, `PgLock`, `PgApply`, `PgCommit`, `MemServe`, `Respond`, ...); translate each through the header comment of `TransferLedger.tla` back to the code line.

## 3. Mirror the change in the model

The model only knows the code through you. For every diff in a verified function, find the matching part:

| Code | Model |
| --- | --- |
| `debit()` checks `available < amount` / `owed + amount > limit` | `Apply`, switch `CheckFunds` |
| `applyPayIdTransfer` `amount > solSendRemaining(...)` | `Apply`, switch `CheckSolLimit` |
| `credit()` clamps (`Math.max(0, ...)`) | `Apply`, `Max(0, @ - a)` |
| repository writes `result.recipient` | `Install`, switch `CreditRecipient` |
| `INSERT INTO marsbank_transfer_requests ... ON CONFLICT DO NOTHING` | `PgClaim`, switch `ClaimRequest` |
| `SELECT ... FOR UPDATE` in `lockSlugs` order | `PgLock` / `LockList`, switch `LockRows` |
| everything after the locks until COMMIT | `PgApply` + `PgCommit` (writes private until commit) |
| `this.processed.get(requestId)` | `MemServe`, switch `MemoryChecksProcessed` |
| `exclusive()` with a body that has no `await` | `MemServe` is one step |
| `resetAll` table locks | `Reset` guard |
| `crypto.randomUUID()` per `postTransfer` call | `ClientRetry`, switch `ClientReusesRequestId` |

If the change is one of the switches, run the baseline with the switch set the way the code now is:

```bash
bash verification/transfer-ledger/check.sh --set LockRows=FALSE baseline
```

Otherwise edit `TransferLedger.tla` (and `modelApply` in `step-contract.test.ts` for changes inside `applySharedTransfer`) so each action does exactly what the new code does, with the same atomic steps: one model step per `await` that another request can interleave with, except writes a database transaction keeps private until COMMIT. Then run step 2.

## 4. Real bug or modeling error?

A row that differs from the baseline is one of:

- **Real bug.** Walk the trace through the code by hand: every step is something the code can do in that order (two requests both waiting on the same lock, a fetch rejecting mid-transaction, ...). If you can tell that story with real function names, the change breaks a promise. Report it with the trace in the code's words. Do not change the property, the bounds, or the baseline to hide it.
- **Modeling error.** A step in the trace the code cannot take: an action fires that the code guards (for example the model lets two transactions hold one `FOR UPDATE` row), a step is coarser or finer than the code, or a TLC `tla-error`/`deadlock` from a typo. Fix `TransferLedger.tla` or `MC.tla` to match the code and rerun. Also suspect the model when a `broken-*` row starts passing: the property no longer sees the check it guards.
- **step-contract failure.** It runs the real code, so a mismatch means `applySharedTransfer` and `Apply` disagree. If the code change was intended, update both `modelApply` and `Apply`; if not, it is a real bug.

## 5. Intended change: update the verification

1. Update `TransferLedger.tla`, `MC.tla`, `step-contract.test.ts`, and the `SCENARIOS` table in `check.sh` together so they describe the new code.
2. If the change fixes a finding, move its scenario to `pass`, update the Findings list and the Baseline table here, and for finding 2 make `knownOverpayLoss` return 0 and replace the `overpayCases` assertion.
3. Keep at least one `broken-*` scenario per property, each failing on its property.
4. Run `npm run verify:transfer-ledger` until every row matches the baseline you wrote down.

## 6. Move the sync commit forward

Only after step 5 passes on a committed tree, and you have read the diff of every covered function since the old sync commit and confirmed the model matches it:

```bash
git rev-parse HEAD > verification/transfer-ledger/sync-commit
bash verification/transfer-ledger/check.sh --drift   # must say the files match
```

Commit `sync-commit` with the model changes. Never move it to silence `--drift` without that review.

## Scope

Covered: own transfers Sol Account ↔ Expedition Credit, PayID to another resident and to a non-resident payee, duplicate delivery of a request body, fetch rejection at any point, response loss, one rolled-back Postgres transaction, one `resetAll`, both repositories.

Bounds: 2 residents (aaron, ben), 3 racing sends per scenario, at most 4 request bodies, balances 0..4, `SOL_SEND_LIMIT` scaled to 2 and `DEMO_CREDIT_LIMIT` to 3. The step-contract test covers the other accounts (`acc-reserve`, `acc-offset`, `acc-habitat-loan`) and boundary values at the real `SOL_SEND_LIMIT` and `DEMO_CREDIT_LIMIT`.

Assumptions: Postgres runs at READ COMMITTED (the `postgres` package default for `sql.begin`); an insert of a key another open transaction inserted waits for it; `FOR UPDATE` reads the latest committed row; the `MemoryLedgerRepository.transfer` body has no `await`; one Next.js process holds the memory repository; all sends fall within one sol.

Excluded: step-up confirmation (`needsStepUp`, covered by `lib/ledger.test.ts`), sol rollover, the `holdReserve` debug-mode scenario (`holdReserveAvailable` deliberately splits available from current), `updateCardStatus`, `ensureSeeded`, `available` differing from `current`, double clicks before React disables the button, a `requestId` reused across residents, the register poll in `lib/store.tsx`.
