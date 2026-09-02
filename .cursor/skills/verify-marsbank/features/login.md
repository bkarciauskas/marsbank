# Login

Login lets a visitor pick one of six fictional Mars residents, enter the demo bank, land on the signed-in desk, and log out back to the public site.

## Sub-features

- `login-open` opens `/login` from the public site.
- `login-roster` fills Mars Bank ID and password from a demo-resident radio.
- `login-enter` posts the demo session and lands on `/banking`.
- `login-home` shows the greeting, sol line, client id, and accounts ledger.
- `login-reject` keeps the visitor on `/login` with an alert when the password is wrong.
- `login-logout` clears the session and returns to `/`.

## How to get to it (user POV)

- Open `/login` directly.
- Choose **Enter** in the public header, **Mars Bank online** in the utility nav, **Enter Mars Bank** in the hero or footer, or **Enter secure banking** on the public site.
- After a session expires or `/banking` is opened without a cookie, the app redirects to `/login`.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` reports login HTTP 200.
- No `marsbank-demo-session` cookie is set in the browser context.

- **Open login.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs login` (or `page.goto("http://127.0.0.1:4317/login")`). The heading reads `Your accounts can't.` and a radiogroup legend `Demo resident` is visible. Cameron is checked by default.
- **Pick a resident.** Choose the Aaron roster card. Run `page.locator("label").filter({ has: page.getByRole("radio", { name: /aaron/i }) }).click()`. The Aaron radio is checked and the ID field shows `aaron@marsbank.mars`. The radio input itself is covered by its label — do not click the `input` directly.
- **Enter.** Choose **Enter Mars Bank**. Run `page.getByRole("button", { name: "Enter Mars Bank" }).click()` and `page.waitForURL("**/banking")`. The heading is `Good evening, Aaron` and the intro includes `Client MB-110274`.
- **Confirm session.** `GET /api/register` with the browser cookies returns 200 and `snapshot.customer.email` is `aaron@marsbank.mars`.
- **Reject bad password.** On a fresh context, open `/login`, replace the password with `wrong`, and submit. An alert reads `That ID and password do not match the demo access record.` and the URL stays on `/login`.
- **Log out.** From `/banking`, choose **Log out**. Run `page.getByRole("button", { name: /Log out/i }).click()`. The browser lands on `/` and a later `GET /api/register` is 401.
- **Proof.** Keep `01-login-form.png`, `01-login-form.aria.txt`, `02-banking-home.png`, `02-banking-home.aria.txt`, `register.json`, and `proof.json` under `evidence/<runId>/login/`.

## Gotchas

- Prefilling Cameron and clicking **Enter Mars Bank** is a valid smoke, but it does not prove roster selection. Prefer Aaron (the harness default) or another non-default resident.
- Setting `marsbank-demo-session` or `POST /api/session` is not login proof. Those are secondary APIs.
- Submit copy becomes `Opening your register` while the request is in flight. Wait for `/banking`, not for the original button name to persist.
- `/banking` without a valid demo cookie redirects to `/login`. A 200 on `/login` after a banking URL means the session was missing, not that login failed.
- Demo passwords are fictional fixtures in `lib/fixtures.ts`. Do not invent or request real secrets.
