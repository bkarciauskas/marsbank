# Settings

Settings shows the signed-in resident's profile and restores the shared demo registers.

## Sub-features

- `settings-open` opens Settings from the resident name in the desk identity bar.
- `settings-profile` shows the name, Mars Bank ID, and member ID.
- `settings-restore` confirms **Restore shared demo** and returns all six residents to their seed balances.

## How to get to it (user POV)

- While signed in, choose the resident name beside the bell. For Aaron the link name includes `Aaron`.
- Open `/banking/settings` while signed in.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron).
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open settings.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs settings` or choose `page.locator("a.desk-customer")`. URL is `/banking/settings`. The heading is `Settings`.
- **Read the profile.** Aaron shows `aaron@marsbank.mars` and `MB-110274`. Cameron shows `cameron@marsbank.mars` and `MB-104821`.
- **Restore.** Choose **Restore shared demo**, then **Restore all registers**. The note reads `All six registers restored.` Aaron's Sol Account available returns to `1000096410`. Cameron's returns to `1000184220`.
- **Proof.** Keep `01-settings.png`, `02-restored.png`, the matching `.aria.txt` files, `register.json`, and `proof.json` under `evidence/<runId>/settings/`.

## Gotchas

- Restore resets every resident on this Next process, not only the signed-in one. Run this drive after proofs that post tokens.
- The resident link's accessible name includes the initials, so prefer `a.desk-customer` over a loose name match. Other rows on the page can also contain the given name.
- **Keep shared balances** cancels the confirm step and leaves the ledger as it is.
