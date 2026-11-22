# Notifications

Notifications is the bell on every signed-in banking page. It lists credits other residents sent to this register, and open payment requests this resident can approve or decline.

## Sub-features

- `notifications-open` opens the bell from the desk identity bar.
- `notifications-empty` shows an empty seeded register, with **Mark all as read** disabled.
- `notifications-request` approves or declines an open request when one is waiting. A request above 50,000 tokens asks for confirmation before **Confirm payment** when that amount still fits the remaining 250,000-token PayID limit for this sol. Above the remaining limit, **Approve** posts immediately and shows the limit message.

## How to get to it (user POV)

- While signed in, choose the **Notifications** button in the desk identity bar. It sits between **Demo data** and the resident name, on `/banking` and the other desk pages.
- When unread credits or open requests are waiting, the button name is `Notifications, N unread`. N is unread credits plus open requests. **Mark all as read** counts credits only, so it stays disabled when the only waiting item is a request.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). The empty panel needs no incoming credit from another resident and no open payment request. Seed data meets that. An own-account transfer does not fill the bell.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open the bell.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs notifications` or choose `getByRole("button", { name: "Notifications", exact: true })`.
- **Read the empty panel.** The region is named `Incoming transfers`. The heading is `Incoming transfers`. The panel says `No tokens from other residents yet.` **Mark all as read** is disabled.
- **Create a request.** The other of Aaron and Cameron opens `/banking/transfer`, chooses **Request tokens**, fills **Request from resident** with the signed-in resident, enters `60000`, and chooses **Send request**. The notice reads `Requested 60,000 tokens from Aaron.` when Aaron will pay.
- **Approve from the bell.** `drive.mjs notifications` does that create step after the empty panel. Within about 5 seconds the button reads `Notifications, 1 unread` and **Mark all as read** stays disabled. The row reads `Cameron requested 60,000 tokens` when Aaron is signed in. **Approve** reveals `I confirm sending 60,000 tokens to Cameron.` **Confirm payment** stays disabled until that box is checked. The command then chooses **Cancel** and **Decline**, and the empty line returns.
- **Proof.** Keep `01-bell-open.png`, `02-request.png`, the matching `.aria.txt` files, and `proof.json` under `evidence/<runId>/notifications/`.

## Gotchas

- Use an exact name on **Notifications**. A badge changes the name to `Notifications, N unread`.
- The empty line stays until another resident sends a credit or opens a request. An own-account transfer leaves the bell empty.
- The panel closes on Escape and on a click outside it. A click meant for the page can dismiss the request before **Decline**.
- Approving past the remaining sol PayID limit skips the checkbox and shows `Passes your 250,000 tokens PayID limit for this sol.`
- Approving a request moves tokens. Decline, or restore the shared demo, before a later proof that needs seed balances.
