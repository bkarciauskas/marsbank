---
name: demo-break
description: Plant the known Mars Bank offset-available hold for a live pstack TDD demo. Use only when a human types /demo-break. Never invent a bug, commit, or merge.
disable-model-invocation: true
---

# Plant the demo bug

Work from the repository root.

1. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs apply`.
2. Require JSON `state` of `planted`.
3. Stop. Do not invent another bug. Do not edit any other file.
4. Do not commit. Do not open a pull request. Do not merge. Do not push to `main`.

The plant leaves `current` moving on offset accounts and freezes `available`. `debit` in `lib/ledger.ts` is the only change.

## Talk track

Demo the broken bank on `http://localhost:3000`, not on the verify port.

- Sign in as Aaron.
- Open Send. Choose **Between my accounts**.
- Send `10000` tokens from Sol Account to the habitat loan.
- The heading reads **Tokens dispatched**.
- Sol Account **Available** does not drop. Stay on the accounts list or the send form. The account detail hero uses `current` and will look fine.

`lib/ledger.test.ts` fails while the plant is applied. Leave it red until `/demo-fix`.

## Live proof port

`verify-marsbank` runs on its own port. `drive.mjs transfer` fails on `acc-everyday.available` while the plant is applied. Launch and doctor pass.
