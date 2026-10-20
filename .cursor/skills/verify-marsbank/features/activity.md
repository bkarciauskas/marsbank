# Activity

Activity is the Mars-local movement ledger: every posted debit and credit across the register, searchable from the desk.

## Sub-features

- `activity-open` opens the full ledger from home or a direct URL.
- `activity-search` narrows rows to a description query such as Areology Coffee.
- `activity-empty` shows **No movement on this account** and `0 matching movements`.
- `activity-clear` removes the query and restores **Posted by sol**.
- `activity-csv` downloads the rows on screen with **Download CSV**. The control is disabled when no rows match.

## How to get to it (user POV)

- Choose **View all** next to **Recent transactions** on `/banking`.
- Submit the desk search (scope **Everything** or **Movements**) with a query, which routes to `/banking/activity?q=…`.
- Open `/banking/activity` or `/banking/activity?q=Habitat` while signed in.

## Driving it with Playwright

Preconditions:

- Mars Bank is healthy at `http://127.0.0.1:4317`.
- Signed in as Aaron (or Cameron). Seed movements include several **Areology Coffee** lines.
- `node .cursor/skills/verify-marsbank/scripts/doctor.mjs` still passes.

- **Search from the desk.** Run `node .cursor/skills/verify-marsbank/scripts/drive.mjs activity` or fill the searchbox `Search transactions, accounts and payees` with `Areology Coffee` and submit `form.desk-search`. URL is `/banking/activity?q=Areology%20Coffee`.
- **Read results.** Heading `Token movement` and `Results for “Areology Coffee”`. Every `.transaction-row` contains Areology Coffee. The result count in the subtitle is greater than zero.
- **Clear.** Choose **Clear search**. Run `page.getByRole("link", { name: /Clear search/i }).click()`. URL is `/banking/activity` and the section heading returns to `Posted by sol`.
- **Empty query.** Open `/banking/activity?q=phobos%20shipyard`. Copy includes `0 matching movements` and `No movement on this account`. **Download CSV** is disabled.
- **Download the list.** Choose **Download CSV**. The file contains the rows currently listed, including after a search.
- **Proof.** Keep `01-search-results.png`, `02-full-ledger.png`, matching `.aria.txt` files, and `proof.json` under `evidence/<runId>/activity/`.

## Gotchas

- Desk search with scope **Accounts** goes to `/banking/accounts`, not activity. Leave scope on **Everything** or **Movements**.
- Curly quotes in `Results for “Areology Coffee”` are the UI's own characters. Match the heading with a regex or the exact punctuation from `app/banking/activity/page.tsx`.
- Home **Recent transactions** is only the first five rows. It is not the full activity ledger.
- `scripts/capture-desk.mjs` already uses `/banking/activity?q=Habitat` as a visual route; Habitat matches offset movements, not Areology Coffee.
