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
    expect(sol && availableBalance(sol)).toBe(322_750);
  });

  it("serializes concurrent transfers against the latest balance", async () => {
    const repository = createMemoryLedgerRepository();
    const results = await Promise.all([
      repository.transfer("aaron", "concurrent-request-1", sendToBen(60_000)),
      repository.transfer("aaron", "concurrent-request-2", sendToBen(60_000)),
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
    expect(sol && availableBalance(sol)).toBe(312_750);
  });
});
