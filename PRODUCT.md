# Mars Bank product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, and Tailwind CSS.

## Users

Mars Bank serves people who live and work on Mars. Demo residents are Cameron, Aaron, Ben, Richard, Robin, and Blake. Each has a fictional Mars Bank ID and password on the login roster so a presenter can switch customers without typing.

## Product purpose

Mars Bank is a fictional retail bank for Mars residents. The first release must make a customer banking demo feel complete from the public homepage through login and daily account management.

## Positioning

Mars Bank measures money in model tokens. Tokens mean the same input and output units used by frontier AI models. They are not blockchain assets.

## Operating context

The demo starts on a public banking website. The customer picks a demo resident to fill login details, then manages a single property loan, the accounts that offset it, a credit card, and transfers. Mars Bank resident transfers update both customers in a shared hosted demo ledger.

## Capabilities and constraints

- Build a polished public homepage, login, dashboard, accounts, cards, and transfers.
- Use mock data only. Do not connect real banking, authentication, payment, or blockchain services.
- Prefill the demo credentials and keep them fictional.
- Make the demo status clear enough that the login cannot collect real credentials.
- Use local assets and app-owned route handlers. Do not proxy production APIs.
- Treat one token as the display currency unit. Do not imply that tokens are tradeable assets.
- Report posted token movement by flow and habit. Those totals are posted lines, not available balances.

## Brand commitments

- The product name is Mars Bank.
- The public site takes its layout, information architecture, and interaction cues from `macquarie.com.au`.
- Replace Macquarie names and logos with Mars Bank.
- Use the Mars Bank orbital-arc lockup and Orbital Registry theme (graphite, survey mint, oxide, coordinate blue) across public and banking surfaces.
- The experience must feel like a legitimate premium bank, not a space-themed game.

## Evidence on hand

- The public Macquarie website is the visual and structural reference.
- No final Mars Bank logo, customer claims, awards, rates, or legal credentials exist. Do not fabricate them.
- All customer and transaction data is synthetic.

## Product principles

- Make the banking workflow credible before adding breadth.
- Prefer a few polished daily banking tasks over a long list of shallow features.
- Use Mars context in the product details, not as decorative novelty.
- Keep model tokens understandable as money without suggesting blockchain.
- Let a customer enter and explore the demo without setup.

## Accessibility and inclusion

Use semantic HTML, visible keyboard focus, sufficient contrast, reduced-motion support, and clear labels for amounts and account states.
