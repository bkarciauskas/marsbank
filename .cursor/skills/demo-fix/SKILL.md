---
name: demo-fix
description: Fix the planted Mars Bank offset-available hold with TDD, prove it with verify-marsbank, and open a pull request. Use only when a human types /demo-fix. Updates a Cursor canvas after every stage.
disable-model-invocation: true
---

# Fix the planted hold

Work from the repository root. Invoke `/tdd`. Read [verify-marsbank](../verify-marsbank/SKILL.md).

Run `node .cursor/skills/demo-pstack/scripts/plant.mjs status`. Require `planted`. Otherwise stop and tell the human to run `/demo-break`.

Do not merge. Do not push to `main`. Do not include the planted `debit` in the final tree.

## Tracker

After every stage below, run the tracker command, then save the canvas with the Write tool at `canvasPath` so Cursor compiles it. Link that path in chat.

```bash
node .cursor/skills/demo-pstack/scripts/tracker.mjs init
node .cursor/skills/demo-pstack/scripts/tracker.mjs start <id>
node .cursor/skills/demo-pstack/scripts/tracker.mjs done <id>
```

Stage ids, in order: `canvas`, `tests-red`, `fix`, `tests-green`, `verify`, `pr`.

## Stages

### canvas

`init`, then `done canvas`. Tell the human to open the canvas beside chat.

### tests-red

`start tests-red`. Follow `/tdd`. Add the file in [failing-tests.md](../demo-pstack/references/failing-tests.md). Do not edit `lib/ledger.ts` yet.

Run `npx vitest run lib/ledger.offset-available.test.ts lib/ledger.test.ts`. Require a red `available` assertion (`1_000_184_220` received, `1_000_174_220` wanted). Then `done tests-red`.

### fix

`start fix`. Run `node .cursor/skills/demo-pstack/scripts/plant.mjs revert`. Require `healthy`. Then `done fix`.

### tests-green

`start tests-green`. Re-run the same vitest command. Require pass. Then `done tests-green`.

### verify

`start verify`. Follow [verify-marsbank](../verify-marsbank/SKILL.md). Drive `transfer`. Require `acc-everyday.available` dropped by `10000`. Then `done verify`.

### pr

`start pr`. Commit only the new test file. Open a ready pull request. Put the verify evidence paths and screenshots in the body. Do not merge. Then `done pr`.

Lead the final reply with the total runtime from the last canvas save.
