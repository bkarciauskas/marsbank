import { describe, expect, it } from "vitest";
import type { BankSnapshot, TransferResult } from "./domain";
import { DEMO_CREDIT_LIMIT, seedSnapshot } from "./fixtures";
import { accountId, cardId } from "./ids";
import {
  applyPayIdTransfer,
  applyTransfer,
  availableBalance,
  displayBalance,
  needsStepUp,
  registerPosition,
  offsetAccounts,
  offsetTotal,
  sentThisSol,
  setCardStatus,
  SOL_SEND_LIMIT,
  solSendRemaining,
  STEP_UP_THRESHOLD,
} from "./ledger";
import { tokens } from "./money";

describe("Mars Bank ledger", () => {
  it("tallies on-hand deposits against habitat debt", () => {
    const position = registerPosition(seedSnapshot.accounts);

    expect(position.onHand).toBe(4_002_644_620);
    expect(position.owing).toBe(36_400_082_640);
    expect(position.net).toBe(-32_397_438_020);
  });

  it("counts a single offset account as on hand", () => {
    const reserve = seedSnapshot.accounts.find(
      (account) => account.id === "acc-reserve",
    );
    if (!reserve || reserve.kind !== "offset") {
      throw new Error("missing reserve");
    }

    expect(registerPosition([reserve])).toEqual({
      onHand: reserve.current,
      owing: tokens(0),
      net: reserve.current,
    });
  });

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
    expect(everyday && availableBalance(everyday)).toBe(1_000_174_220);
    expect(reserve && availableBalance(reserve)).toBe(2_001_850_000);
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
      amount: tokens(2_000_000_000),
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
    if (loan?.kind === "loan") expect(loan.remaining).toBe(36_399_980_000);
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
    expect(everyday && displayBalance(everyday)).toBe(1_000_184_220);
    expect(credit && displayBalance(credit)).toBe(82_640);
    expect(loan && displayBalance(loan)).toBe(36_400_000_000);
  });

  it("treats deposit accounts as offsets on the property loan", () => {
    const loanId = accountId("acc-habitat-loan");
    const offsets = offsetAccounts(seedSnapshot, loanId);

    expect(offsets.map((account) => account.name)).toEqual([
      "Sol Account",
      "Long Horizon Reserve",
      "Habitat Offset",
    ]);
    expect(offsetTotal(seedSnapshot, loanId)).toBe(4_002_644_620);
  });

  it("rejects a credit draw that exceeds the limit", () => {
    const result = applyTransfer(structuredClone(seedSnapshot), {
      from: accountId("acc-credit"),
      to: accountId("acc-everyday"),
      amount: tokens(DEMO_CREDIT_LIMIT),
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
    expect(everyday && availableBalance(everyday)).toBe(1_000_181_720);
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

describe("PayID send limits", () => {
  const morning = new Date("2026-08-26T08:00:00.000Z");

  function sendToCursor(
    snapshot: BankSnapshot,
    amount: number,
    now: Date,
    stepUpConfirmed = true,
  ): TransferResult {
    return applyPayIdTransfer(
      snapshot,
      {
        from: accountId("acc-everyday"),
        amount: tokens(amount),
        description: "",
        payee: {
          scheme: "cursor",
          id: "@cursor",
          displayName: "Cursor",
          institution: "Cursor",
        },
        stepUpConfirmed,
      },
      now,
    );
  }

  function posted(result: TransferResult): BankSnapshot {
    if (result.kind !== "ok") throw new Error(`expected ok, got ${result.kind}`);
    return result.snapshot;
  }

  it("rejects a send that passes the per-sol limit and leaves the register alone", () => {
    const afterFirst = posted(
      sendToCursor(structuredClone(seedSnapshot), 200_000, morning),
    );

    expect(sendToCursor(afterFirst, 50_001, morning)).toEqual({
      kind: "sol-limit",
    });
    expect(sentThisSol(afterFirst, morning)).toBe(200_000);
    expect(solSendRemaining(afterFirst, morning)).toBe(50_000);
  });

  it("allows a send that lands exactly on the limit, then nothing more", () => {
    const afterFirst = posted(
      sendToCursor(structuredClone(seedSnapshot), 200_000, morning),
    );
    const atLimit = posted(sendToCursor(afterFirst, 50_000, morning));

    expect(sentThisSol(atLimit, morning)).toBe(SOL_SEND_LIMIT);
    expect(sendToCursor(atLimit, 1, morning)).toEqual({ kind: "sol-limit" });
    expect(
      sendToCursor(structuredClone(seedSnapshot), SOL_SEND_LIMIT, morning).kind,
    ).toBe("ok");
    expect(
      sendToCursor(structuredClone(seedSnapshot), SOL_SEND_LIMIT + 1, morning),
    ).toEqual({ kind: "sol-limit" });
  });

  it("requires step-up confirmation above the threshold", () => {
    const seed = structuredClone(seedSnapshot);

    expect(sendToCursor(seed, STEP_UP_THRESHOLD + 1, morning, false)).toEqual({
      kind: "step-up-required",
    });
    expect(sendToCursor(seed, STEP_UP_THRESHOLD + 1, morning, true).kind).toBe(
      "ok",
    );
  });

  it("skips step-up at or below the threshold", () => {
    const seed = structuredClone(seedSnapshot);

    expect(needsStepUp(STEP_UP_THRESHOLD)).toBe(false);
    expect(sendToCursor(seed, STEP_UP_THRESHOLD, morning, false).kind).toBe(
      "ok",
    );
    expect(sendToCursor(seed, 2_500, morning, false).kind).toBe("ok");
  });

  it("resets the limit when the sol rolls over at 00:00 UTC", () => {
    const lastSecond = new Date("2026-08-26T23:59:59.000Z");
    const nextSol = new Date("2026-08-27T00:00:00.000Z");
    const spent = posted(
      sendToCursor(structuredClone(seedSnapshot), SOL_SEND_LIMIT, lastSecond),
    );

    expect(sendToCursor(spent, 1, lastSecond)).toEqual({ kind: "sol-limit" });
    expect(sentThisSol(spent, nextSol)).toBe(0);
    expect(sendToCursor(spent, SOL_SEND_LIMIT, nextSol).kind).toBe("ok");
  });

  it("does not limit or count moves between the resident's own accounts", () => {
    const moved = applyTransfer(
      structuredClone(seedSnapshot),
      {
        from: accountId("acc-everyday"),
        to: accountId("acc-reserve"),
        amount: tokens(600_000_000),
        description: "",
      },
      morning,
    );

    expect(sentThisSol(posted(moved), morning)).toBe(0);
  });
});
