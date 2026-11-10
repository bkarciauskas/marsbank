import { describe, expect, it } from "vitest";
import type { Account, BankSnapshot, HostedTransferCommand } from "@/lib/domain";
import { DEMO_CREDIT_LIMIT, demoResidentBySlug, seedSnapshotForSlug } from "@/lib/fixtures";
import { accountId, txnId, type AccountId } from "@/lib/ids";
import { registerPosition, sentThisSol, SOL_SEND_LIMIT } from "@/lib/ledger";
import { tokens } from "@/lib/money";
import { applySharedTransfer } from "@/lib/shared-ledger";

// TransferLedger.tla treats applySharedTransfer as one step (Apply). This
// file checks, on every combination of boundary values below, that the real
// function does what Apply says, and that every ok result keeps the
// properties the model checks across steps.

const NOW = new Date("2026-11-10T12:00:00.000Z");
const ALL_ACCOUNTS = [
  "acc-everyday",
  "acc-reserve",
  "acc-offset",
  "acc-credit",
  "acc-habitat-loan",
].map((id) => accountId(id));

type Balances = { everyday: number; owed: number; loan: number; sent: number };

function register(slug: string, balances: Balances): BankSnapshot {
  const seed = seedSnapshotForSlug(slug);
  const accounts = seed.accounts.map((account): Account => {
    switch (account.kind) {
      case "offset": {
        const value = account.id === "acc-everyday" ? balances.everyday : 1;
        return { ...account, available: tokens(value), current: tokens(value) };
      }
      case "credit":
        return { ...account, owed: tokens(balances.owed) };
      case "loan":
        return { ...account, remaining: tokens(balances.loan) };
      default:
        return account;
    }
  });
  const sent =
    balances.sent > 0
      ? [
          {
            id: txnId("earlier-send-out"),
            accountId: accountId("acc-everyday"),
            postedOn: NOW.toISOString(),
            description: "Earlier send",
            amount: tokens(balances.sent),
            direction: "debit" as const,
            payee: {
              scheme: "payid" as const,
              id: "someone@elsewhere.example",
              displayName: "Someone",
              institution: "Elsewhere",
            },
          },
        ]
      : [];
  return { ...seed, accounts, transactions: sent };
}

function account(snapshot: BankSnapshot, id: AccountId): Account {
  const found = snapshot.accounts.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

function everyday(snapshot: BankSnapshot): number {
  const sol = account(snapshot, accountId("acc-everyday"));
  return sol.kind === "offset" ? sol.current : Number.NaN;
}

function owed(snapshot: BankSnapshot): number {
  const card = account(snapshot, accountId("acc-credit"));
  return card.kind === "credit" ? card.owed : Number.NaN;
}

function net(snapshot: BankSnapshot): number {
  return registerPosition(snapshot.accounts).net;
}

function overdrawn(snapshot: BankSnapshot): string[] {
  return snapshot.accounts.flatMap((candidate) => {
    switch (candidate.kind) {
      case "transaction":
      case "savings":
      case "offset":
        return candidate.available < 0 || candidate.current < 0 ? [candidate.id] : [];
      case "credit":
        return candidate.owed < 0 || candidate.owed > candidate.limit ? [candidate.id] : [];
      case "loan":
        return candidate.remaining < 0 ? [candidate.id] : [];
    }
  });
}

function payid(to: string, amount: number): HostedTransferCommand {
  return {
    kind: "payid",
    command: {
      from: accountId("acc-everyday"),
      amount: tokens(amount),
      description: "",
      payee: { scheme: "payid", id: to, displayName: to, institution: "Mars Bank" },
    },
  };
}

function own(from: AccountId, to: AccountId, amount: number): HostedTransferCommand {
  return { kind: "own", command: { from, to, amount: tokens(amount), description: "" } };
}

// Apply in TransferLedger.tla, for the routes it models.
function modelApply(
  command: HostedTransferCommand,
  aaron: Balances,
): { result: string; everyday?: number; owed?: number; sent?: number; benGets?: number } {
  const a = command.command.amount;
  if (command.kind === "payid") {
    if (a > Math.max(0, SOL_SEND_LIMIT - aaron.sent)) return { result: "sol-limit" };
    if (aaron.everyday < a) return { result: "insufficient-funds" };
    return {
      result: "ok",
      everyday: aaron.everyday - a,
      owed: aaron.owed,
      sent: aaron.sent + a,
      benGets: command.command.payee.id === "ben@marsbank.mars" ? a : 0,
    };
  }
  if (command.command.from === "acc-everyday") {
    if (aaron.everyday < a) return { result: "insufficient-funds" };
    return { result: "ok", everyday: aaron.everyday - a, owed: Math.max(0, aaron.owed - a), sent: aaron.sent };
  }
  if (aaron.owed + a > DEMO_CREDIT_LIMIT) return { result: "credit-limit" };
  return { result: "ok", everyday: aaron.everyday + a, owed: aaron.owed + a, sent: aaron.sent };
}

const EVERYDAY = [0, 1, 2, 3];
const OWED = [0, 1, DEMO_CREDIT_LIMIT - 1, DEMO_CREDIT_LIMIT];
const LOAN = [0, 1, 3];
const SENT = [0, SOL_SEND_LIMIT - 2, SOL_SEND_LIMIT - 1, SOL_SEND_LIMIT];
const AMOUNTS = [0, 1, 2, 3];
const BEN: Balances = { everyday: 1, owed: 0, loan: 0, sent: 0 };

type Case = { aaron: Balances; command: HostedTransferCommand; label: string };

function* cases(): Generator<Case> {
  for (const everydayValue of EVERYDAY)
    for (const owedValue of OWED)
      for (const loan of LOAN)
        for (const sent of SENT)
          for (const amount of AMOUNTS) {
            const aaron = { everyday: everydayValue, owed: owedValue, loan, sent };
            const tag = `aaron ${JSON.stringify(aaron)} amount ${amount}`;
            for (const from of ALL_ACCOUNTS)
              for (const to of ALL_ACCOUNTS)
                yield { aaron, command: own(from, to, amount), label: `${tag} own ${from}->${to}` };
            yield { aaron, command: payid("ben@marsbank.mars", amount), label: `${tag} payid ben` };
            yield { aaron, command: payid("someone@elsewhere.example", amount), label: `${tag} payid outside` };
          }
}

// The repositories pass a recipient only when recipientSlug() finds a resident.
function run({ aaron, command }: Case) {
  const sender = register("aaron", aaron);
  const recipient = register("ben", BEN);
  const toBen = command.kind === "payid" && command.command.payee.id === "ben@marsbank.mars";
  const result = applySharedTransfer({
    command,
    now: NOW,
    recipient: toBen ? recipient : undefined,
    recipientResident: toBen ? demoResidentBySlug("ben") : undefined,
    requestId: "step-contract",
    sender,
  });
  return { sender, recipient, result };
}

// Own transfers into a card or habitat loan: credit() clamps at zero, so the
// part of the amount above what is owed is debited and lands nowhere.
function knownOverpayLoss({ aaron, command }: Case): number {
  if (command.kind !== "own" || command.command.from === command.command.to) return 0;
  const a = command.command.amount;
  if (command.command.to === "acc-credit") return Math.max(0, a - aaron.owed);
  if (command.command.to === "acc-habitat-loan") return Math.max(0, a - aaron.loan);
  return 0;
}

describe("TransferLedger.tla Apply step matches lib/ code", () => {
  it("accepts and rejects exactly where the model does, with the same balances", () => {
    const mismatches: string[] = [];
    for (const testCase of cases()) {
      const { command } = testCase;
      const modeled =
        command.kind === "payid" ||
        (command.command.from === "acc-everyday" && command.command.to === "acc-credit") ||
        (command.command.from === "acc-credit" && command.command.to === "acc-everyday");
      if (!modeled || command.command.amount <= 0) continue;

      const { result } = run(testCase);
      const expected = modelApply(command, testCase.aaron);
      const actual =
        result.kind === "ok"
          ? {
              result: "ok",
              everyday: everyday(result.sender),
              owed: owed(result.sender),
              sent: sentThisSol(result.sender, NOW),
              ...(command.kind === "payid"
                ? { benGets: result.recipient ? everyday(result.recipient) - BEN.everyday : 0 }
                : {}),
            }
          : { result: result.kind };
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        mismatches.push(`${testCase.label}: code ${JSON.stringify(actual)} model ${JSON.stringify(expected)}`);
      }
    }
    expect(mismatches.slice(0, 5)).toEqual([]);
  });

  it("keeps every ok transfer within balances, limits and the sol limit", () => {
    const failures: string[] = [];
    for (const testCase of cases()) {
      const { sender, result } = run(testCase);
      if (result.kind !== "ok") continue;
      const after = [...overdrawn(result.sender), ...(result.recipient ? overdrawn(result.recipient) : [])];
      if (after.length > 0) failures.push(`${testCase.label}: overdrawn ${after.join(", ")}`);
      const sentAfter = sentThisSol(result.sender, NOW);
      if (sentAfter > SOL_SEND_LIMIT) failures.push(`${testCase.label}: sent ${sentAfter} this sol`);
      const expectedSent =
        sentThisSol(sender, NOW) + (testCase.command.kind === "payid" ? testCase.command.command.amount : 0);
      if (sentAfter !== expectedSent) failures.push(`${testCase.label}: sentThisSol ${sentAfter}, expected ${expectedSent}`);
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("moves tokens without creating or destroying them, except the recorded overpay finding", () => {
    const failures: string[] = [];
    let overpayCases = 0;
    for (const testCase of cases()) {
      const { sender, recipient, result } = run(testCase);
      if (result.kind !== "ok") continue;
      const outside =
        testCase.command.kind === "payid" && !result.recipient ? testCase.command.command.amount : 0;
      const before = net(sender) + net(recipient);
      const after = net(result.sender) + net(result.recipient ?? recipient) + outside;
      const loss = knownOverpayLoss(testCase);
      if (loss > 0) overpayCases += 1;
      if (before - after !== loss) {
        failures.push(`${testCase.label}: ${before - after} tokens lost, recorded finding says ${loss}`);
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
    // When the overpay finding is fixed this drops to 0: update knownOverpayLoss,
    // finding-overpay-memory in check.sh, and the skill's findings together.
    expect(overpayCases).toBeGreaterThan(0);
  });
});
