import { describe, expect, it } from "vitest";
import { transactionsMatchingSearch } from "./activity-search";
import { seedSnapshot } from "./fixtures";

describe("expedition credit search repro", () => {
  it("finds credit-card movements when the query is the account name", () => {
    const matches = transactionsMatchingSearch(seedSnapshot, "Expedition Credit");

    expect(matches.length).toBeGreaterThan(0);
    for (const transaction of matches) {
      const account = seedSnapshot.accounts.find(
        (row) => row.id === transaction.accountId,
      );
      expect(account?.name).toBe("Expedition Credit");
    }
  });
});