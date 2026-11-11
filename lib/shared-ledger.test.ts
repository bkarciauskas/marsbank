import { describe, expect, it } from "vitest";
import { demoResidentBySlug, seedSnapshotForSlug } from "./fixtures";
import { accountId, paymentRequestId } from "./ids";
import { availableBalance, displayBalance } from "./ledger";
import { tokens } from "./money";
import {
  applyApprovePaymentRequest,
  applyCancelPaymentRequest,
  applyCreatePaymentRequest,
  applyDeclinePaymentRequest,
  applySharedTransfer,
} from "./shared-ledger";

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

  it("creates, approves, declines, and cancels resident payment requests", () => {
    const aaronResident = demoResidentBySlug("aaron");
    const benResident = demoResidentBySlug("ben");
    expect(aaronResident).toBeDefined();
    expect(benResident).toBeDefined();
    if (!aaronResident || !benResident) return;

    const now = new Date("2026-10-20T09:00:00.000Z");
    const created = applyCreatePaymentRequest({
      amount: tokens(1_200),
      description: "Arc Canteen tray",
      id: paymentRequestId("pr-001"),
      now,
      payer: seedSnapshotForSlug("ben"),
      payerResident: benResident,
      requester: seedSnapshotForSlug("aaron"),
      requesterResident: aaronResident,
    });
    expect(created.kind).toBe("ok");
    if (created.kind !== "ok") return;

    expect(created.request).toMatchObject({
      id: "pr-001",
      requesterSlug: "aaron",
      payerSlug: "ben",
      amount: 1_200,
      description: "Arc Canteen tray",
      status: "open",
    });

    const approved = applyApprovePaymentRequest({
      command: {
        paymentRequestId: paymentRequestId("pr-001"),
        from: accountId("acc-everyday"),
      },
      now: new Date("2026-10-20T09:05:00.000Z"),
      payer: created.counterparty,
      payerSlug: "ben",
      requester: created.actor,
      requesterResident: aaronResident,
    });
    expect(approved.kind).toBe("ok");
    if (approved.kind !== "ok") return;

    expect(approved.request.status).toBe("paid");
    const benSol = approved.actor.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const aaronSol = approved.counterparty.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(benSol && availableBalance(benSol)).toBe(1_000_311_550);
    expect(aaronSol && availableBalance(aaronSol)).toBe(1_000_097_610);

    const replay = applyApprovePaymentRequest({
      command: {
        paymentRequestId: paymentRequestId("pr-001"),
        from: accountId("acc-everyday"),
      },
      now: new Date("2026-10-20T09:06:00.000Z"),
      payer: approved.actor,
      payerSlug: "ben",
      requester: approved.counterparty,
      requesterResident: aaronResident,
    });
    expect(replay).toEqual({ kind: "request-not-open" });

    const declinedSeed = applyDeclinePaymentRequest({
      command: { paymentRequestId: paymentRequestId("pr-001") },
      now: new Date("2026-10-20T09:05:00.000Z"),
      payer: created.counterparty,
      payerSlug: "ben",
      requester: created.actor,
    });
    expect(declinedSeed.kind).toBe("ok");
    if (declinedSeed.kind === "ok") {
      expect(declinedSeed.request.status).toBe("declined");
      expect(declinedSeed.counterparty.paymentRequests[0]?.status).toBe(
        "declined",
      );
    }

    const cancelledSeed = applyCancelPaymentRequest({
      command: { paymentRequestId: paymentRequestId("pr-001") },
      now: new Date("2026-10-20T09:05:00.000Z"),
      payer: created.counterparty,
      requester: created.actor,
      requesterSlug: "aaron",
    });
    expect(cancelledSeed.kind).toBe("ok");
    if (cancelledSeed.kind === "ok") {
      expect(cancelledSeed.request.status).toBe("cancelled");
      expect(cancelledSeed.counterparty.paymentRequests[0]?.status).toBe(
        "cancelled",
      );
    }
  });

  it("enforces the 50,000 MT step-up check and 250,000 MT sol cap on approval", () => {
    const aaronResident = demoResidentBySlug("aaron");
    const benResident = demoResidentBySlug("ben");
    if (!aaronResident || !benResident) return;

    const now = new Date("2026-10-20T10:00:00.000Z");
    const first = applyCreatePaymentRequest({
      amount: tokens(200_000),
      description: "Rover charter",
      id: paymentRequestId("pr-large-1"),
      now,
      payer: seedSnapshotForSlug("ben"),
      payerResident: benResident,
      requester: seedSnapshotForSlug("aaron"),
      requesterResident: aaronResident,
    });
    if (first.kind !== "ok") return;

    const second = applyCreatePaymentRequest({
      amount: tokens(60_000),
      description: "Extra cells",
      id: paymentRequestId("pr-large-2"),
      now,
      payer: first.counterparty,
      payerResident: benResident,
      requester: first.actor,
      requesterResident: aaronResident,
    });
    if (second.kind !== "ok") return;

    const unconfirmed = applyApprovePaymentRequest({
      command: {
        paymentRequestId: paymentRequestId("pr-large-1"),
        from: accountId("acc-everyday"),
      },
      now,
      payer: second.counterparty,
      payerSlug: "ben",
      requester: second.actor,
      requesterResident: aaronResident,
    });
    expect(unconfirmed).toEqual({ kind: "step-up-required" });

    const confirmed = applyApprovePaymentRequest({
      command: {
        paymentRequestId: paymentRequestId("pr-large-1"),
        from: accountId("acc-everyday"),
        stepUpConfirmed: true,
      },
      now,
      payer: second.counterparty,
      payerSlug: "ben",
      requester: second.actor,
      requesterResident: aaronResident,
    });
    expect(confirmed.kind).toBe("ok");
    if (confirmed.kind !== "ok") return;

    const overCap = applyApprovePaymentRequest({
      command: {
        paymentRequestId: paymentRequestId("pr-large-2"),
        from: accountId("acc-everyday"),
        stepUpConfirmed: true,
      },
      now,
      payer: confirmed.actor,
      payerSlug: "ben",
      requester: confirmed.counterparty,
      requesterResident: aaronResident,
    });
    expect(overCap).toEqual({ kind: "sol-limit" });
  });
});
