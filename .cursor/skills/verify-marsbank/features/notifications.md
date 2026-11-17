# Notifications

Notifications is the bell on every signed-in banking page. It lists credits other residents sent to this register, and open payment requests this resident can approve or decline.

## Sub-features

- `notifications-open` opens the bell from the desk identity bar.
- `notifications-empty` shows an empty seeded register, with **Mark all as read** disabled.
- `notifications-request` approves or declines an open request when one is waiting. A request above 50,000 tokens asks for confirmation before **Confirm payment**.

## How to get to it (user POV)

- While signed in, choose the **Notifications** button in the desk identity bar. It sits between **Demo data** and the resident name, on `/banking` and the other desk pages.
- When something is unread, the button name is `Notifications, N unread`.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). The empty panel needs no incoming credit from another resident and no open payment request. Seed data meets that. An own-account transfer does not fill the bell.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Open the bell.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs notifications` or choose `getByRole("button", { name: "Notifications", exact: true })`.
- **Read the empty panel.** The region is named `Incoming transfers`. The heading is `Incoming transfers`. The panel says `No tokens from other residents yet.` **Mark all as read** is disabled.
- **Approve a request (separate pass).** This needs an open request addressed to the signed-in resident. The panel lists **Approve** and **Decline**. Above 50,000 tokens, **Approve** reveals a checkbox and **Confirm payment** stays disabled until that box is checked. The shipped script does not create a request, so it does not prove this pass.
- **Proof.** Keep `01-bell-open.png`, `01-bell-open.aria.txt`, and `proof.json` under `evidence/<runId>/notifications/`.

## Gotchas

- Use an exact name on **Notifications**. A badge changes the name to `Notifications, N unread`.
- The empty line stays until another resident sends a credit or opens a request. An own-account transfer leaves the bell empty. The shipped drive proves that empty panel only.
- Approving a request moves tokens. Decline, or restore the shared demo, before a later proof that needs seed balances.
