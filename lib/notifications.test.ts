import { describe, expect, it } from "vitest";
import type { BankSnapshot } from "./domain";
import { demoResidentBySlug, demoResidents, seedSnapshotForSlug } from "./fixtures";
import { accountId, paymentRequestId, txnId } from "./ids";
import { applyTransfer } from "./ledger";
import { tokens } from "./money";
import {
  bellBadgeCount,
  incomingTransfers,
  markAllRead,
  openIncomingRequests,
  outgoingRequests,
  unreadCount,
  type IncomingTransfer,
} from "./notifications";
import {
  applyCreatePaymentRequest,
  applyDeclinePaymentRequest,
  applySharedTransfer,
} from "./shared-ledger";

function send(
  sender: BankSnapshot,
  recipient: BankSnapshot,
  amount: number,
  at: string,
  description = "",
): { sender: BankSnapshot; recipient: BankSnapshot } {
  const result = applySharedTransfer({
    command: {
      kind: "payid",
      command: {
        from: accountId("acc-everyday"),
        amount: tokens(amount),
        description,
        payee: {
          scheme: "payid",
          id: recipient.customer.email,
          displayName: recipient.customer.displayName,
          institution: "Mars Bank",
        },
      },
    },
    now: new Date(at),
    recipient,
    recipientResident: demoResidents.find(
      (resident) => resident.email === recipient.customer.email,
    ),
    requestId: `req-${at}`,
    sender,
  });
  if (result.kind !== "ok") throw new Error(result.kind);
  return { sender: result.sender, recipient: result.recipient ?? recipient };
}

function feedFor(postedOn: readonly string[]): IncomingTransfer[] {
  return postedOn.map((at, index) => ({
    id: txnId(`txn-${index}`),
    postedOn: at,
    amount: tokens(10),
    senderName: "Aaron Vale",
    senderEmail: "aaron@marsbank.mars",
    description: "Transfer from Aaron Vale",
  }));
}

describe("incomingTransfers", () => {
  it("is empty on every seeded register", () => {
    for (const resident of demoResidents) {
      expect(incomingTransfers(seedSnapshotForSlug(resident.slug))).toEqual([]);
    }
  });

  it("lists credits another resident sent, newest first", () => {
    const aaron = seedSnapshotForSlug("aaron");
    const robin = seedSnapshotForSlug("robin");
    let ben = seedSnapshotForSlug("ben");
    ben = send(aaron, ben, 250, "2026-10-20T10:00:00.000Z", "Dust filters").recipient;
    ben = send(robin, ben, 40, "2026-10-20T11:00:00.000Z").recipient;

    expect(incomingTransfers(ben)).toEqual([
      expect.objectContaining({
        postedOn: "2026-10-20T11:00:00.000Z",
        amount: 40,
        senderName: robin.customer.displayName,
        senderEmail: "robin@marsbank.mars",
        description: `Transfer from ${robin.customer.displayName}`,
      }),
      expect.objectContaining({
        postedOn: "2026-10-20T10:00:00.000Z",
        amount: 250,
        senderName: aaron.customer.displayName,
        senderEmail: "aaron@marsbank.mars",
        description: "Dust filters",
      }),
    ]);
  });

  it("leaves out own-account credits and the sender's outgoing debit", () => {
    const aaron = seedSnapshotForSlug("aaron");
    const ben = seedSnapshotForSlug("ben");
    const sent = send(aaron, ben, 250, "2026-10-20T10:00:00.000Z");
    const ownMove = applyTransfer(sent.recipient, {
      from: accountId("acc-everyday"),
      to: accountId("acc-reserve"),
      amount: tokens(5),
      description: "",
    });
    if (ownMove.kind !== "ok") throw new Error(ownMove.kind);

    expect(incomingTransfers(sent.sender)).toEqual([]);
    expect(incomingTransfers(ownMove.snapshot)).toHaveLength(1);
  });
});

describe("unreadCount", () => {
  const feed = feedFor([
    "2026-10-20T11:00:00.000Z",
    "2026-10-20T10:00:00.000Z",
  ]);

  it("counts everything before the resident has read anything", () => {
    expect(unreadCount(feed, null)).toBe(2);
  });

  it("counts only credits posted after the read marker", () => {
    expect(unreadCount(feed, "2026-10-20T10:00:00.000Z")).toBe(1);
    expect(unreadCount(feed, "2026-10-20T11:00:00.000Z")).toBe(0);
  });
});

describe("markAllRead", () => {
  it("moves the marker to the newest credit and clears the count", () => {
    const feed = feedFor([
      "2026-10-20T10:00:00.000Z",
      "2026-10-20T11:00:00.000Z",
    ]);
    const readThrough = markAllRead(feed, null);

    expect(readThrough).toBe("2026-10-20T11:00:00.000Z");
    expect(unreadCount(feed, readThrough)).toBe(0);
  });

  it("lights up again for a credit that lands after marking read", () => {
    const readThrough = markAllRead(feedFor(["2026-10-20T10:00:00.000Z"]), null);
    const later = feedFor([
      "2026-10-20T12:00:00.000Z",
      "2026-10-20T10:00:00.000Z",
    ]);

    expect(unreadCount(later, readThrough)).toBe(1);
  });

  it("never moves the marker backwards", () => {
    expect(markAllRead(feedFor([]), "2026-10-20T11:00:00.000Z")).toBe(
      "2026-10-20T11:00:00.000Z",
    );
    expect(
      markAllRead(
        feedFor(["2026-10-20T10:00:00.000Z"]),
        "2026-10-20T11:00:00.000Z",
      ),
    ).toBe("2026-10-20T11:00:00.000Z");
  });
});

describe("payment request notification selectors", () => {
  it("surfaces open incoming requests to the recipient and outgoing requests to the requester", () => {
    const aaronResident = demoResidentBySlug("aaron");
    const benResident = demoResidentBySlug("ben");
    if (!aaronResident || !benResident) return;

    const created = applyCreatePaymentRequest({
      amount: tokens(850),
      description: "Canteen split",
      id: paymentRequestId("pr-bell-1"),
      now: new Date("2026-10-20T12:00:00.000Z"),
      payer: seedSnapshotForSlug("ben"),
      payerResident: benResident,
      requester: seedSnapshotForSlug("aaron"),
      requesterResident: aaronResident,
    });
    expect(created.kind).toBe("ok");
    if (created.kind !== "ok") return;

    expect(openIncomingRequests(created.counterparty)).toHaveLength(1);
    expect(openIncomingRequests(created.actor)).toHaveLength(0);
    expect(outgoingRequests(created.actor)).toHaveLength(1);
    expect(outgoingRequests(created.counterparty)).toHaveLength(0);
    expect(
      bellBadgeCount(
        feedFor(["2026-10-20T11:00:00.000Z"]),
        null,
        openIncomingRequests(created.counterparty),
      ),
    ).toBe(2);

    const declined = applyDeclinePaymentRequest({
      command: { paymentRequestId: paymentRequestId("pr-bell-1") },
      now: new Date("2026-10-20T12:05:00.000Z"),
      payer: created.counterparty,
      payerSlug: "ben",
      requester: created.actor,
    });
    expect(declined.kind).toBe("ok");
    if (declined.kind !== "ok") return;

    expect(openIncomingRequests(declined.actor)).toHaveLength(0);
    expect(outgoingRequests(declined.counterparty)[0]?.status).toBe("declined");
  });
});
