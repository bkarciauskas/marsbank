import { describe, expect, it } from "vitest";
import { seedSnapshot } from "./fixtures";
import { accountId, cardId } from "./ids";
import {
  applyPayIdTransfer,
  applyTransfer,
  availableBalance,
  displayBalance,
  offsetAccounts,
  offsetTotal,
  setCardStatus,
} from "./ledger";
import { tokens } from "./money";

describe("Mars Bank ledger", () => {
  it("moves tokens and adds both transaction sides", () => {
    const result = applyTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        to: accountId("acc-reserve"),
        amount: tokens(10_000),
        description: "Reserve contribution",
      },
      new Date("2026-08-26T10:00:00.000Z"),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const everyday = result.snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const reserve = result.snapshot.accounts.find(
      (account) => account.id === "acc-reserve",
    );
    expect(everyday && availableBalance(everyday)).toBe(174_220);
    expect(reserve && availableBalance(reserve)).toBe(1_850_000);
    expect(result.snapshot.transactions.slice(0, 2)).toMatchObject([
      { direction: "debit", amount: 10_000 },
      { direction: "credit", amount: 10_000 },
    ]);
  });

  it("rejects invalid sources and unavailable balances", () => {
    const same = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-everyday"),
      to: accountId("acc-everyday"),
      amount: tokens(1),
      description: "",
    });
    const loan = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-habitat-loan"),
      to: accountId("acc-everyday"),
      amount: tokens(1),
      description: "",
    });
    const tooLarge = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-everyday"),
      to: accountId("acc-reserve"),
      amount: tokens(999_999_999),
      description: "",
    });

    expect(same).toEqual({ kind: "same-account" });
    expect(loan).toEqual({ kind: "loan-not-source" });
    expect(tooLarge).toEqual({ kind: "insufficient-funds" });
  });

  it("repays a habitat loan from an offset account", () => {
    const result = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-offset"),
      to: accountId("acc-habitat-loan"),
      amount: tokens(20_000),
      description: "Additional repayment",
    });

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const loan = result.snapshot.accounts.find(
      (account) => account.id === "acc-habitat-loan",
    );
    expect(loan?.kind).toBe("loan");
    if (loan?.kind === "loan") expect(loan.remaining).toBe(36_380_000);
  });

  it("reports display balance by account kind", () => {
    const snapshot = structuredClone(seedSnapshot);
    const everyday = snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const credit = snapshot.accounts.find(
      (account) => account.id === "acc-credit",
    );
    const loan = snapshot.accounts.find(
      (account) => account.id === "acc-habitat-loan",
    );
    expect(everyday && displayBalance(everyday)).toBe(184_220);
    expect(credit && displayBalance(credit)).toBe(82_640);
    expect(loan && displayBalance(loan)).toBe(36_400_000);
  });

  it("treats deposit accounts as offsets on the property loan", () => {
    const loanId = accountId("acc-habitat-loan");
    const offsets = offsetAccounts(seedSnapshot, loanId);

    expect(offsets.map((account) => account.name)).toEqual([
      "Sol Account",
      "Long Horizon Reserve",
      "Habitat Offset",
    ]);
    expect(offsetTotal(seedSnapshot, loanId)).toBe(2_644_620);
  });

  it("rejects a credit draw that exceeds the limit", () => {
    const result = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-credit"),
      to: accountId("acc-everyday"),
      amount: tokens(500_000),
      description: "",
    });
    expect(result).toEqual({ kind: "credit-limit" });
  });

  it("freezes a card without rewriting other cards", () => {
    const next = setCardStatus(
      structuredClone(seedSnapshot),
      cardId("card-everyday"),
      "frozen",
    );
    expect(next.cards.find((card) => card.id === "card-everyday")?.status).toBe(
      "frozen",
    );
    expect(next.cards.find((card) => card.id === "card-credit")?.status).toBe(
      "active",
    );
    expect(next.revision).toBe(seedSnapshot.revision + 1);
  });

  it("debits a PayID transfer without crediting an own account", () => {
    const result = applyPayIdTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        amount: tokens(2_500),
        description: "Studio seat",
        payee: {
          scheme: "cursor",
          id: "@cursor",
          displayName: "Cursor",
          institution: "Cursor",
        },
      },
      new Date("2026-08-26T10:00:00.000Z"),
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const everyday = result.snapshot.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(everyday && availableBalance(everyday)).toBe(181_720);
    expect(result.snapshot.transactions[0]).toMatchObject({
      direction: "debit",
      amount: 2_500,
      description: "Studio seat",
      payee: { id: "@cursor" },
    });
    expect(
      result.snapshot.transactions.filter(
        (transaction) => transaction.postedOn === "2026-08-26T10:00:00.000Z",
      ),
    ).toHaveLength(1);
  });
});
