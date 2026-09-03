# Cards

Cards shows the physical Sol card and virtual Expedition card and lets the resident freeze or unfreeze each one without closing the token account.

## Sub-features

- `cards-open` opens the card desk from the sidebar.
- `cards-list` shows last four, holder, expiry, and Active / Frozen state.
- `cards-freeze` freezes a card and restates the control as **Unfreeze card**.
- `cards-unfreeze` returns the same card to **Active**.

## How to get to it (user POV)

- Choose **Cards** in the Banking sidebar or the mobile **Cards** tab.
- Open `/banking/cards` while signed in.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). Both seed cards start **Active**.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open cards.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs cards` or choose sidebar **Cards**: `page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Cards" }).click()`. URL is `/banking/cards`. Heading is `Cards for every airlock`.
- **See seed cards.** Aaron shows last fours `2209` (physical Sol Account) and `4418` (virtual Expedition Credit). Cameron shows `4821` and `9072`.
- **Freeze.** Choose the first **Freeze card**. Run `page.getByRole("button", { name: "Freeze card" }).first().click()`. That card shows **Frozen** and **Unfreeze card**.
- **Confirm side effect.** `GET /api/register` includes a card with `status: "frozen"`.
- **Unfreeze.** Choose **Unfreeze card**. The same card returns to **Active** / **Freeze card**.
- **Proof.** Keep `01-active.png`, `02-frozen.png`, matching `.aria.txt` files, `register.json`, and `proof.json` under `evidence/<runId>/cards/`.

## Gotchas

- There are two freeze buttons. Target `.first()` or scope to one `article.card-panel`. A loose `getByText("Frozen")` can match the status badge and the `FROZEN` overlay on the same panel — not the security heading `Lost beyond the airlock?`. Prefer `{ exact: true }` on the badge or the button name.
- Freeze is a real mutation on this process's ledger. Unfreeze (or Settings restore) before a later cards proof.
- `/api/cards` PATCH is the backend for the button. Calling it directly is not cards-desk proof.
