import { describe, expect, it } from "vitest";
import { demoResidentBySlug, seedSnapshotForSlug } from "./fixtures";
import { accountId } from "./ids";
import { availableBalance, displayBalance } from "./ledger";
import { tokens } from "./money";
import { applySharedTransfer } from "./shared-ledger";

describe("shared resident transfers", () => {
  it("debits the sender and credits the recipient Sol Account", () => {
    const recipientResident = demoResidentBySlug("aaron");
    expect(recipientResident).toBeDefined();
    if (!recipientResident) return;

    const result = applySharedTransfer({
      command: {
        kind: "payid",
        command: {
          from: accountId("acc-everyday"),
          amount: tokens(10_000),
          description: "Habitat supplies",
          payee: {
            scheme: "payid",
            id: recipientResident.email,
            displayName: recipientResident.givenName,
            institution: "Mars Bank",
          },
        },
      },
      now: new Date("2026-08-28T06:00:00.000Z"),
      recipient: seedSnapshotForSlug("aaron"),
      recipientResident,
      requestId: "transfer-001",
      sender: seedSnapshotForSlug("cameron"),
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok" || !result.recipient) return;
    const senderSol = result.sender.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const recipientSol = result.recipient.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(senderSol && availableBalance(senderSol)).toBe(1_000_174_220);
    expect(recipientSol && availableBalance(recipientSol)).toBe(1_000_106_410);
    expect(result.recipient.transactions[0]).toMatchObject({
      id: "transfer-001-in",
      amount: 10_000,
      direction: "credit",
      payee: {
        id: "cameron@marsbank.mars",
        displayName: "Cameron",
      },
    });
  });

  it("holds reserve available when the debug-mode walk is staged", () => {
    const result = applySharedTransfer({
      command: {
        kind: "own",
        command: {
          from: accountId("acc-everyday"),
          to: accountId("acc-reserve"),
          amount: tokens(10_000),
          description: "Reserve contribution",
        },
      },
      holdReserve: true,
      now: new Date("2026-08-26T10:00:00.000Z"),
      requestId: "debug-hold-001",
      sender: seedSnapshotForSlug("cameron"),
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const reserve = result.sender.accounts.find(
      (account) => account.id === "acc-reserve",
    );
    expect(reserve && availableBalance(reserve)).toBe(2_001_840_000);
    expect(reserve && displayBalance(reserve)).toBe(2_001_850_000);
  });
});
