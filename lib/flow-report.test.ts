import { describe, expect, it } from "vitest";
import type { Transaction } from "./domain";
import { seedSnapshot } from "./fixtures";
import { accountId, txnId } from "./ids";
import { applyTransfer } from "./ledger";
import { tokens } from "./money";
import { drillFromQuery, flowPage, type ClassifiedMovement } from "./flow-report";

function movementById(
  movements: readonly ClassifiedMovement[],
  id: string,
): ClassifiedMovement | undefined {
  return movements.find((movement) => movement.transaction.id === id);
}

function sumFlow(
  movements: readonly ClassifiedMovement[],
  flow: ClassifiedMovement["flow"],
): number {
  return movements
    .filter((movement) => movement.flow === flow)
    .reduce((total, movement) => total + movement.transaction.amount, 0);
}

describe("flowPage", () => {
  it("classifies seed habits from counterparty then description", () => {
    const page = flowPage(seedSnapshot, { kind: "overview" });
    const food = movementById(page.report.movements, "txn-001");
    const work = movementById(page.report.movements, "txn-002");
    const transit = movementById(page.report.movements, "txn-003");
    const habitat = movementById(page.report.movements, "txn-004");
    const internalIn = movementById(page.report.movements, "txn-005");
    const internalOut = page.report.movements.find(
      (movement) =>
        movement.transaction.counterpartyAccountId === accountId("acc-reserve") &&
        movement.transaction.direction === "debit" &&
        movement.transaction.amount === 35_000,
    );

    expect(food).toMatchObject({ flow: "out", habit: "food" });
    expect(work).toMatchObject({ flow: "in", habit: "work" });
    expect(transit).toMatchObject({ flow: "out", habit: "transit" });
    expect(habitat).toMatchObject({ flow: "out", habit: "habitat" });
    expect(internalIn).toMatchObject({ flow: "internal", habit: "transfer" });
    expect(internalOut).toMatchObject({ flow: "internal", habit: "transfer" });
    expect(page.report.habits.map((row) => row.habit)).toEqual(
      expect.arrayContaining([
        "habitat",
        "food",
        "transit",
        "work",
        "transfer",
        "unclassified",
      ]),
    );
    expect(
      page.report.movements.some(
        (movement) => movement.habit === "unclassified",
      ),
    ).toBe(true);
  });

  it("keeps both internal legs and totals debit-side volume once", () => {
    const page = flowPage(seedSnapshot, { kind: "overview" });
    const internals = page.report.movements.filter(
      (movement) => movement.flow === "internal",
    );
    const debitInternal = internals
      .filter((movement) => movement.transaction.direction === "debit")
      .reduce((total, movement) => total + movement.transaction.amount, 0);
    const creditInternal = internals
      .filter((movement) => movement.transaction.direction === "credit")
      .reduce((total, movement) => total + movement.transaction.amount, 0);

    expect(internals.length).toBeGreaterThanOrEqual(2);
    expect(creditInternal).toBe(debitInternal);
    expect(page.report.totals.internalDebit).toBe(debitInternal);
    expect(page.report.totals.out).toBe(sumFlow(page.report.movements, "out"));
    expect(page.report.totals.in).toBe(sumFlow(page.report.movements, "in"));
  });

  it("classifies a live applyTransfer pair as internal without doubling", () => {
    const before = flowPage(seedSnapshot, { kind: "overview" });
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

    const after = flowPage(result.snapshot, { kind: "overview" });
    const posted = after.report.movements.filter(
      (movement) =>
        movement.transaction.postedOn === "2026-08-26T10:00:00.000Z",
    );

    expect(posted).toHaveLength(2);
    expect(posted.every((movement) => movement.flow === "internal")).toBe(true);
    expect(after.report.totals.internalDebit).toBe(
      before.report.totals.internalDebit + 10_000,
    );
    expect(after.report.totals.in).toBe(before.report.totals.in);
    expect(after.report.totals.out).toBe(before.report.totals.out);
  });

  it("treats a PayID debit without a counterparty as outgoing", () => {
    const payIdDebit: Transaction = {
      id: txnId("txn-payid"),
      accountId: accountId("acc-everyday"),
      postedOn: "2026-08-25T11:20:00.000Z",
      description: "Cursor seat",
      amount: tokens(2_500),
      direction: "debit",
      payee: {
        scheme: "cursor",
        id: "@cursor",
        displayName: "Cursor",
        institution: "Cursor",
      },
    };

    const page = flowPage(
      { ...seedSnapshot, transactions: [payIdDebit] },
      { kind: "overview" },
    );

    expect(page.report.movements[0]).toMatchObject({
      flow: "out",
      habit: "unclassified",
    });
    expect(page.report.totals.internalDebit).toBe(0);
  });

  it("parses overview when query keys are absent or invalid", () => {
    expect(drillFromQuery({})).toEqual({ kind: "overview" });
    expect(drillFromQuery({ view: "flow", flow: "sideways" })).toEqual({
      kind: "overview",
    });
    expect(drillFromQuery({ view: "habit", habit: "food" })).toEqual({
      kind: "habit",
      habit: "food",
    });
  });

  it("returns missing for an unknown movement id", () => {
    const wanted = { kind: "movement" as const, txnId: txnId("txn-missing") };
    const page = flowPage(seedSnapshot, wanted);

    expect(page.slice).toEqual({ kind: "missing", wanted });
  });

  it("returns missing for a habit with no posted lines", () => {
    const empty = { ...seedSnapshot, transactions: [] };
    const wanted = { kind: "habit" as const, habit: "food" as const };
    const page = flowPage(empty, wanted);

    expect(page.slice).toEqual({ kind: "missing", wanted });
  });

  it("drills a habit slice from the same report", () => {
    const page = flowPage(seedSnapshot, { kind: "habit", habit: "food" });

    expect(page.slice.kind).toBe("habit");
    if (page.slice.kind !== "habit") return;
    expect(page.slice.row.habit).toBe("food");
    expect(
      page.slice.movements.every((movement) => movement.habit === "food"),
    ).toBe(true);
    expect(page.slice.movements.length).toBeGreaterThan(0);
  });

  it("keeps habit share as a 0–10000 integer", () => {
    const page = flowPage(seedSnapshot, { kind: "overview" });

    for (const row of page.report.habits) {
      expect(Number.isInteger(row.outShare)).toBe(true);
      expect(row.outShare).toBeGreaterThanOrEqual(0);
      expect(row.outShare).toBeLessThanOrEqual(10_000);
    }
  });
});
