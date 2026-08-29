---
version: 1
slug: "app-banking-page-tsx"
primary_target: "app/banking/page.tsx"
related_targets: ["app/banking/activity/page.tsx","app/banking/accounts/page.tsx","app/banking/accounts/[accountId]/page.tsx","app/banking/cards/page.tsx","app/banking/transfer/page.tsx","components/banking/banking-shell.tsx","components/banking/account-list.tsx","components/banking/transaction-list.tsx","app/globals.css"]
---

# Banking workspace

- Scope: authenticated banking routes under `app/banking`
- Mode: Operate
- Audience: Cameron reviewing a daily financial position on Mars
- Job: understand total available position and recent movement at a glance, then enter an account or transfer
- Constraints: retain the left desktop navigation and mobile bottom navigation; preserve all existing routes and behavior; use the Orbital Registry identity

## Chosen direction

Cross-account Coordinate Register. The overview opens with a broad total-position band, then a continuous account ledger occupies the main plane while recent movement runs in a compact dated annotation rail. Approved comp: `.impeccable/mocks/banking-register-a.png`.

## Memorable moment

The total position and every account balance share one plotted coordinate system, so the customer reads the whole bank as one exact register rather than a pile of cards.

## Implementation inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| Desktop navigation | 236px graphite rail, orbital lockup, four existing routes, oxide active state | Semantic links + Lucide icons |
| Customer bar | Compact account context, security/support/logout actions | HTML/CSS |
| Position band | Oversized total in signal blue, model-token unit, oxide transfer action | HTML/CSS |
| Account register | Four continuous rows, shared columns, product/account metadata, exact balances | Semantic links + CSS grid |
| Movement rail | Five dated transactions, direction and amount, view-all link | HTML/CSS |
| Lower continuation | Summary/activity sections continue the ledger grammar without nested cards | HTML/CSS |
| Responsive | Main register stacks above activity; rows preserve labels and exact amounts; mobile nav stays fixed | CSS media queries |

## Component grammar

Sharp corners, one-pixel survey rules, no card shadows, no rounded content containers. Display numerals and headings use condensed Saira; body and metadata use Saira. Oxide is action, blue is total/focus, graphite is the page ground and rail, mint is type and the active nav pill.

## Unresolved decisions

None.
