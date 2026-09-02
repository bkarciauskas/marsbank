# Failing tests to add during `/demo-fix`

Create `lib/ledger.offset-available.test.ts`. Do not edit `lib/ledger.ts` until this file fails for the planted reason.

```ts
import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./fixtures";
import { accountId } from "./ids";
import { applyTransfer, availableBalance } from "./ledger";
import { tokens } from "./money";

describe("offset available debit", () => {
  it("drops available and posts both transfer legs", () => {
    const result = applyTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        to: accountId("acc-habitat-loan"),
        amount: tokens(10_000),
        description: "Verification repayment",
      },
      new Date("2026-08-26T10:00:00.000Z"),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const everyday = result.snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(everyday && availableBalance(everyday)).toBe(1_000_174_220);
    expect(result.snapshot.transactions.slice(0, 2)).toMatchObject([
      { direction: "debit", amount: 10_000, postedOn: "2026-08-26T10:00:00.000Z" },
      { direction: "credit", amount: 10_000, postedOn: "2026-08-26T10:00:00.000Z" },
    ]);
  });
});
```

Run `npx vitest run lib/ledger.offset-available.test.ts lib/ledger.test.ts`.

Planted fail: available stays `1_000_184_220` while both legs still post.

Healthy pass: available is `1_000_174_220` and both legs post.
