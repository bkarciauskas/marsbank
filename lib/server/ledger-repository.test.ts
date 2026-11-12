import { describe, expect, it } from "vitest";
import type { HostedTransferCommand } from "../domain";
import { accountId } from "../ids";
import { availableBalance } from "../ledger";
import { tokens } from "../money";
import { createMemoryLedgerRepository } from "./ledger-repository";

function sendToBen(amount: number): HostedTransferCommand {
  return {
    kind: "payid",
    command: {
      from: accountId("acc-everyday"),
      amount: tokens(amount),
      description: "Shared transfer",
      payee: {
        scheme: "payid",
        id: "ben@marsbank.mars",
        displayName: "Ben",
        institution: "Mars Bank",
      },
    },
  };
}

function moveToReserve(amount: number): HostedTransferCommand {
  return {
    kind: "own",
    command: {
      from: accountId("acc-everyday"),
      to: accountId("acc-reserve"),
      amount: tokens(amount),
      description: "Reserve contribution",
    },
  };
}

describe("shared ledger repository", () => {
  it("applies a request ID only once", async () => {
    const repository = createMemoryLedgerRepository();
    const first = await repository.transfer(
      "aaron",
      "request-idempotent",
      sendToBen(10_000),
    );
    const duplicate = await repository.transfer(
      "aaron",
      "request-idempotent",
      sendToBen(10_000),
    );

    expect(duplicate).toEqual(first);
    const ben = await repository.getRegister("ben");
    const sol = ben.accounts.find((account) => account.id === "acc-everyday");
    expect(sol && availableBalance(sol)).toBe(1_000_322_750);
  });

  it("counts a replayed request ID once toward the per-sol limit", async () => {
    const repository = createMemoryLedgerRepository();
    const large = sendToBen(200_000);
    if (large.kind === "payid") large.command.stepUpConfirmed = true;

    const first = await repository.transfer("aaron", "request-limit-1", large);
    const replay = await repository.transfer("aaron", "request-limit-1", large);
    expect(first.kind).toBe("ok");
    expect(replay).toEqual(first);

    expect(
      (await repository.transfer("aaron", "request-limit-2", sendToBen(50_000)))
        .kind,
    ).toBe("ok");
    expect(
      await repository.transfer("aaron", "request-limit-3", sendToBen(1)),
    ).toEqual({ kind: "sol-limit" });
  });

  it("replays a step-up rejection for the same request ID", async () => {
    const repository = createMemoryLedgerRepository();
    const unconfirmed = sendToBen(60_000);
    const rejected = await repository.transfer(
      "aaron",
      "request-step-up-1",
      unconfirmed,
    );
    const confirmed = sendToBen(60_000);
    if (confirmed.kind === "payid") confirmed.command.stepUpConfirmed = true;

    expect(rejected).toEqual({ kind: "step-up-required" });
    expect(
      await repository.transfer("aaron", "request-step-up-1", confirmed),
    ).toEqual({ kind: "step-up-required" });
    expect(
      (await repository.transfer("aaron", "request-step-up-2", confirmed)).kind,
    ).toBe("ok");
  });

  it("serializes concurrent transfers against the latest balance", async () => {
    const repository = createMemoryLedgerRepository();
    const results = await Promise.all([
      repository.transfer(
        "aaron",
        "concurrent-request-1",
        moveToReserve(600_000_000),
      ),
      repository.transfer(
        "aaron",
        "concurrent-request-2",
        moveToReserve(600_000_000),
      ),
    ]);

    expect(results.filter((result) => result.kind === "ok")).toHaveLength(1);
    expect(
      results.filter((result) => result.kind === "insufficient-funds"),
    ).toHaveLength(1);
  });

  it("restores every resident register", async () => {
    const repository = createMemoryLedgerRepository();
    await repository.transfer(
      "aaron",
      "request-before-reset",
      sendToBen(10_000),
    );
    await repository.resetAll("aaron");

    const ben = await repository.getRegister("ben");
    const sol = ben.accounts.find((account) => account.id === "acc-everyday");
    expect(sol && availableBalance(sol)).toBe(1_000_312_750);
  });

  it("manages resident payment requests across creation, approval, decline, cancel, and reset", async () => {
    const repository = createMemoryLedgerRepository();

    expect(
      await repository.paymentRequest("aaron", {
        action: "create",
        command: { target: "@aaron", amount: tokens(500), description: "Self" },
      }),
    ).toEqual({ kind: "own-payid" });

    expect(
      await repository.paymentRequest("aaron", {
        action: "create",
        command: {
          target: "@cursor",
          amount: tokens(500),
          description: "External",
        },
      }),
    ).toEqual({ kind: "unknown-resident" });

    const created = await repository.paymentRequest("aaron", {
      action: "create",
      command: {
        target: "@ben",
        amount: tokens(60_000),
        description: "Rover batteries",
      },
    });
    expect(created.kind).toBe("ok");
    if (created.kind !== "ok") return;

    const needsConfirm = await repository.paymentRequest("ben", {
      action: "approve",
      command: {
        paymentRequestId: created.request.id,
        from: accountId("acc-everyday"),
      },
    });
    expect(needsConfirm).toEqual({ kind: "step-up-required" });

    const approved = await repository.paymentRequest("ben", {
      action: "approve",
      command: {
        paymentRequestId: created.request.id,
        from: accountId("acc-everyday"),
        stepUpConfirmed: true,
      },
    });
    expect(approved.kind).toBe("ok");

    const overCapReq = await repository.paymentRequest("aaron", {
      action: "create",
      command: {
        target: "ben@marsbank.mars",
        amount: tokens(200_000),
        description: "Habitat dome glass",
      },
    });
    expect(overCapReq.kind).toBe("ok");
    if (overCapReq.kind !== "ok") return;

    const overCapApprove = await repository.paymentRequest("ben", {
      action: "approve",
      command: {
        paymentRequestId: overCapReq.request.id,
        from: accountId("acc-everyday"),
        stepUpConfirmed: true,
      },
    });
    expect(overCapApprove).toEqual({ kind: "sol-limit" });

    const declined = await repository.paymentRequest("ben", {
      action: "decline",
      command: { paymentRequestId: overCapReq.request.id },
    });
    expect(declined.kind).toBe("ok");

    await repository.resetAll("aaron");
    expect((await repository.getRegister("aaron")).paymentRequests).toEqual([]);
    expect((await repository.getRegister("ben")).paymentRequests).toEqual([]);
  });

  it("saves and pins a contact, keeps it through a transfer, and clears it on reset", async () => {
    const repository = createMemoryLedgerRepository();
    const saved = await repository.contact("aaron", {
      action: "save",
      command: { handle: "@cursor", nickname: "Cursor desk" },
    });
    expect(saved.kind).toBe("ok");
    if (saved.kind !== "ok") return;

    const pinned = await repository.contact("aaron", {
      action: "pin",
      command: { contactId: saved.contact.id, pinned: true },
    });
    expect(pinned.kind).toBe("ok");
    if (pinned.kind !== "ok") return;
    expect(pinned.contact.pinned).toBe(true);

    const sent = await repository.transfer(
      "aaron",
      "request-after-contact",
      sendToBen(1_000),
    );
    expect(sent.kind).toBe("ok");
    if (sent.kind !== "ok") return;
    expect(sent.snapshot.contacts).toEqual([
      expect.objectContaining({
        id: saved.contact.id,
        nickname: "Cursor desk",
        pinned: true,
        payee: expect.objectContaining({ id: "@cursor" }),
      }),
    ]);

    const ben = await repository.getRegister("ben");
    expect(ben.contacts).toEqual([]);

    await repository.resetAll("aaron");
    expect((await repository.getRegister("aaron")).contacts).toEqual([]);
    expect((await repository.getRegister("ben")).contacts).toEqual([]);
  });
});
