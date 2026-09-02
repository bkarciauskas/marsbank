import { describe, expect, it } from "vitest";
import { seedSnapshot } from "../fixtures";
import { accountId } from "../ids";
import { applyTransfer, availableBalance, displayBalance } from "../ledger";
import { tokens } from "../money";
import { holdReserveAvailable } from "./reserve-hold";

describe("reserve hold", () => {
  it("keeps reserve available at the pre-transfer figure", () => {
    const before = structuredClone(seedSnapshot);
    const result = applyTransfer(before, {
      from: accountId("acc-everyday"),
      to: accountId("acc-reserve"),
      amount: tokens(10_000),
      description: "Reserve contribution",
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const held = holdReserveAvailable(before, result.snapshot);
    const reserve = held.accounts.find((account) => account.id === "acc-reserve");
    expect(reserve && availableBalance(reserve)).toBe(2_001_840_000);
    expect(reserve && displayBalance(reserve)).toBe(2_001_850_000);
  });
});
