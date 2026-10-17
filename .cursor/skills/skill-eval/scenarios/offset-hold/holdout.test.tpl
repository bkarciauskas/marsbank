import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./fixtures";
import { accountId } from "./ids";
import { applyPayIdTransfer, applyTransfer, availableBalance, displayBalance } from "./ledger";
import { tokens } from "./money";

const everyday = (snapshot) =>
  snapshot.accounts.find((account) => account.id === "acc-everyday");

describe("holdout: offset debit", () => {
  it("drops available and current together on an own-account send", () => {
    const result = applyTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        to: accountId("acc-habitat-loan"),
        amount: tokens(10_000),
        description: "Holdout repayment",
      },
      new Date("2026-08-26T10:00:00.000Z"),
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const account = everyday(result.snapshot);
    expect(availableBalance(account)).toBe(1_000_174_220);
    expect(displayBalance(account)).toBe(1_000_174_220);
  });

  it("drops available on a PayID send", () => {
    const result = applyPayIdTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        amount: tokens(2_500),
        description: "Holdout seat",
        payee: { scheme: "cursor", id: "@cursor", displayName: "Cursor", institution: "Cursor" },
      },
      new Date("2026-08-26T10:00:00.000Z"),
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(availableBalance(everyday(result.snapshot))).toBe(1_000_181_720);
  });

  it("still refuses a send larger than available", () => {
    const result = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-everyday"),
      to: accountId("acc-reserve"),
      amount: tokens(2_000_000_000),
      description: "",
    });
    expect(result).toEqual({ kind: "insufficient-funds" });
  });
});
