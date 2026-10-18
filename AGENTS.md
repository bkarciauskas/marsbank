<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Mars Bank

Demo bank. Six fictional residents, whole model tokens, an in-memory ledger when you run it locally.

## Layers

- `lib/money.ts`, `lib/domain.ts`, `lib/ledger.ts` — pure. No React, no database.
- `lib/server/ledger-repository.ts` — the only file that opens Postgres. Local dev uses the in-memory repository.
- `app/api/` — route handlers. They check the session and call `getLedgerRepository()`.
- `lib/store.tsx` — client store. UI reaches the bank with `fetch("/api/...")` from here.
- `app/` pages and `components/` — render `useBank()`. Leave `lib/server` to route handlers.

## Copy from

- Token math: `lib/money.ts`, `lib/ledger.ts` (`tokens`, `addTokens`, `subtractTokens`, `parseTokenInput`)
- Route handler: `app/api/transfers/route.ts`
- Banking page: `app/banking/accounts/page.tsx`
- Unit test: `lib/money.test.ts`

## Before you finish

```bash
npx tsc --noEmit
npm run lint
npm run test
```

For a UI change, follow `.cursor/skills/verify-marsbank/SKILL.md`. Leave `/demo` working.

