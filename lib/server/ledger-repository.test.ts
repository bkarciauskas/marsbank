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
    await repository.transfer("aaron", "request-before-reset", sendToBen(10_000));
    await repository.resetAll("aaron");

    const ben = await repository.getRegister("ben");
    const sol = ben.accounts.find((account) => account.id === "acc-everyday");
    expect(sol && availableBalance(sol)).toBe(1_000_312_750);
  });
});
