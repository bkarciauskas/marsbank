import { describe, expect, it } from "vitest";
import {
  authenticateDemo,
  demoEmail,
  demoPassword,
  demoResidents,
  seedSnapshot,
  snapshotForResident,
} from "./fixtures";
import { availableBalance } from "./ledger";
import { latestPostedTime, solNumberFromLatest } from "./sol";

describe("demo residents", () => {
  it("keeps Cameron as the default seeded register", () => {
    expect(seedSnapshot.customer.email).toBe(demoEmail);
    expect(seedSnapshot.customer.initials).toBe("CH");
    expect(seedSnapshot.accounts[0]?.name).toBe("Olympus Arc Habitat");
  });

  it("authenticates each roster resident and rejects a wrong password", () => {
    expect(authenticateDemo(demoEmail, demoPassword)?.slug).toBe("cameron");
    expect(authenticateDemo("aaron@marsbank.mars", "Tharsis!2026")?.slug).toBe(
      "aaron",
    );
    expect(authenticateDemo(demoEmail, "wrong")).toBeUndefined();
    expect(demoResidents.map((resident) => resident.givenName)).toEqual([
      "Cameron",
      "Aaron",
      "Ben",
      "Richard",
      "Robin",
      "Blake",
    ]);
  });

  it("posts 20–40 seed lines and closes the reserve transfer", () => {
    expect(seedSnapshot.transactions.length).toBeGreaterThanOrEqual(20);
    expect(seedSnapshot.transactions.length).toBeLessThanOrEqual(40);
    const credit = seedSnapshot.transactions.find(
      (transaction) => transaction.id === "txn-005",
    );
    expect(credit).toMatchObject({
      direction: "credit",
      amount: 35_000,
      counterpartyAccountId: "acc-everyday",
    });
    expect(
      seedSnapshot.transactions.some(
        (transaction) =>
          transaction.direction === "debit" &&
          transaction.amount === 35_000 &&
          transaction.counterpartyAccountId === "acc-reserve",
      ),
    ).toBe(true);
    expect(
      seedSnapshot.transactions.every(
        (transaction) => !("category" in transaction),
      ),
    ).toBe(true);
    const latest = latestPostedTime(
      seedSnapshot.transactions.map((transaction) => transaction.postedOn),
    );
    expect(
      seedSnapshot.transactions.every(
        (transaction) =>
          solNumberFromLatest(transaction.postedOn, latest) >= 1,
      ),
    ).toBe(true);
    const newest = seedSnapshot.transactions[0]?.postedOn;
    const oldest = seedSnapshot.transactions.at(-1)?.postedOn;
    expect(newest && oldest && newest >= oldest).toBe(true);
  });

  it("makes every resident a token billionaire", () => {
    for (const resident of demoResidents) {
      const snapshot = snapshotForResident(resident);
      const spendable = snapshot.accounts
        .filter((account) => account.kind !== "loan")
        .reduce((total, account) => total + availableBalance(account), 0);
      expect(spendable).toBeGreaterThanOrEqual(1_000_000_000);
    }
  });

  it("seeds a distinct habitat register per resident", () => {
    const aaron = demoResidents.find((resident) => resident.slug === "aaron");
    expect(aaron).toBeDefined();
    if (!aaron) return;
    const snapshot = snapshotForResident(aaron);
    expect(snapshot.customer.displayName).toBe("Aaron");
    expect(snapshot.accounts[0]?.name).toBe("Tharsis Rise Habitat");
    expect(snapshot.customer.email).not.toBe(seedSnapshot.customer.email);
  });
});
