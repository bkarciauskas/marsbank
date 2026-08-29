---
version: 1
slug: "app-banking-page-tsx"
primary_target: "app/banking/page.tsx"
related_targets: ["app/banking/activity/page.tsx","app/banking/accounts/page.tsx","app/banking/accounts/[accountId]/page.tsx","app/banking/cards/page.tsx","app/banking/transfer/page.tsx","components/banking/banking-shell.tsx","components/banking/account-list.tsx","components/banking/transaction-list.tsx","app/globals.css"]
---

# Banking workspace

- Scope: authenticated banking routes under `app/banking`
- Mode: Operate
- Audience: Cameron reviewing a daily financial position on Mars, and a presenter driving the demo live in front of an audience
- Job: read one available total, scan every account on shared columns, check recent movement, then search, open an account, or transfer
- Constraints: keep behavior, data, the orbital lockup, and Mars Bank colors; retain the left desktop navigation and mobile bottom navigation; preserve all existing routes; the demo status must stay legible on every authenticated view

## Chosen direction

Search-led Account Desk. The authenticated surface is a light account desk, not the dark Coordinate Register: a full-width graphite bar carrying the lockup, universal search and identity; a labelled graphite icon rail; then a quiet neutral canvas holding white ledger cards. Approved comp: `.impeccable/mocks/decision/search-led-account-desk.png` (locked from a six-option surface round, seed `e8279d3a`). The five unchosen comps sit beside it in the same directory and carry no approval.

This replaces the Cross-account Coordinate Register direction and its comp `.impeccable/mocks/banking-register-a.png`, which remains only as a record of the superseded world.

## Memorable moment

One reconciled available total: the headline figure and the ledger's totals row are computed from the same set, and every row that means something other than spendable money says so in its own words.

## Implementation inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| Top bar | Full-width graphite, orbital lockup, universal search with scope, demo flag, notifications, customer, log out | Semantic header + form |
| Universal search | Real routing: movements to the activity ledger, accounts to the register, both by `?q=` | Client form + `useSearchParams` |
| Icon rail | 118px graphite, five real routes with labels beneath icons, oxide active edge, Security and Help footer | Semantic links + Lucide icons |
| Greeting band | Sentence-case greeting, sol and client line, available total in signal, oxide transfer | HTML/CSS |
| Account ledger | One white card, shared columns, per-row restated words for loan and credit, reconciled totals row | Semantic links + CSS grid |
| Recent movements | Full-width panel below the ledger, dated rows with MT amounts | HTML/CSS |
| Sol summary | Full-width three-up panel continuing the same column, posted lines only | HTML/CSS |
| Motion | One settle-in on arrival, in reading order, disabled under reduced motion | CSS keyframes |
| Responsive | Two support columns drop below 850px; rail hides for the fixed tab bar; ledger keeps the available figure | CSS media queries |

## Component grammar

Light neutral canvas `#F2F3F5`; white cards with 1px `#E3E5E4` rules and 6px corners; graphite `#101518` chrome in both themes; oxide `#E4623F` for the single primary action; signal `#356CFF` for spendable money only. Hanken Grotesk throughout, sentence case, with 11px tracked uppercase reserved for column and metric labels. Figures are tabular and bare, because the column header carries the MT unit.

## Truth rules

- Signal blue marks spendable money only. A loan's remaining debt and a credit line's limit are never blue.
- A row whose product means something different under a shared header restates its own words: Remaining / Offset / Original for a loan, Available credit / Owing / Limit for a credit line.
- The headline available total and the ledger totals row must reconcile. Deposit balance excludes credit headroom, and loan balances count toward neither.

## Unresolved decisions

- The greeting is hardcoded to "Good evening" regardless of local time.
- The other authenticated routes (cards, transfer, reports, settings, account detail) inherit the desk tokens but have not been composed against this direction.
