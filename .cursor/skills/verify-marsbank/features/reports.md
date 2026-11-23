# Reports

Reports is the signed-in view of posted movement. It totals tokens in, tokens out, and internal movement, then groups outgoing tokens by habit and by the account that paid.

## Sub-features

- `reports-open` opens the posted-movement page from the Banking sidebar.
- `reports-totals` shows **Flow totals** for tokens in, tokens out, and internal movement.
- `reports-spend` groups the same outgoing tokens under **Spend by habit** and **Spend by account**.
- `reports-ledger` follows **Open full ledger** to the activity register.

## How to get to it (user POV)

- Choose **Reports** in the Banking sidebar. Reports is not on the mobile tab bar.
- Open `/banking/activity` with no search and choose **Posted movement**.
- Open `/banking/reports` while signed in.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron).
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open reports.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs reports` or choose `getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Reports" })`. URL is `/banking/reports`. The heading is `Posted movement`.
- **Read the totals.** Headings `Flow totals`, `Spend by habit`, and `Spend by account` are visible.
- **Open the ledger.** Choose **Open full ledger**. URL is `/banking/activity` and the heading is `Token movement`.
- **Proof.** Keep `01-posted-movement.png`, `02-full-ledger.png`, the matching `.aria.txt` files, and `proof.json` under `evidence/<runId>/reports/`.

## Gotchas

- Scope the **Reports** click to the navigation named `Banking`. The word also appears in other copy.
- A drilled link such as `/banking/reports?view=flow&flow=out` replaces the summary with one slice. The drive uses the unsliced page.
- **Open full ledger** is an entry to Activity. A shot of that ledger does not replace the activity search proof.
