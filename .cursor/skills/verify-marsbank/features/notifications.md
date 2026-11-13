# Notifications

Notifications is the desk bell for tokens other residents have sent to this register.

## Sub-features

- `notifications-open` opens the incoming feed from the header bell.
- `notifications-empty` explains that nobody has sent tokens yet.
- `notifications-unread` shows a count and one row per incoming credit.
- `notifications-read` clears the count with **Mark all as read**. The same browser keeps that state across a reload.

## How to get to it (user POV)

- Choose the header button **Notifications** while signed in. When credits are unread, the name is `Notifications, N unread`.
- The panel is labeled **Incoming transfers**.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.
- Ben has not already received a transfer in this process. A fresh launch is the clean start. The command itself signs Ben in first, then Aaron.

- **Open an empty bell.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs notifications`. Ben lands on `/banking`. The button name is `Notifications`. The panel includes `No tokens from other residents yet.` **Mark all as read** is disabled.
- **Receive a send.** Aaron sends `250` tokens to `ben@marsbank.mars` with the note `Dust filters`. Ben's button becomes `Notifications, 1 unread` after the register poll. The row reads `Aaron sent 250 tokens` and includes `Dust filters`.
- **Mark read.** Choose **Mark all as read**. The button name returns to `Notifications` and the unread badge is gone.
- **Proof.** Keep `01-bell-quiet.png`, `02-bell-unread.png`, `03-bell-read.png`, the matching `.aria.txt` files, and `proof.json` under `evidence/<runId>/notifications/`.

## Gotchas

- `--resident` does not change this recipe. Ben receives and Aaron sends.
- The badge waits for Ben's register poll, about 5 seconds. The drive allows 12 seconds.
- A resident does not see their own send in this bell. The credit has to come from someone else.
- **Mark all as read** sticks in that browser profile. A new browser context treats the same credit as unread again.
- Closing the panel with Escape is not the same as marking it read.
