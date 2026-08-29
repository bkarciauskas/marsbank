import type { Account, BankSnapshot, Transaction } from "./domain";
import { txnId, type TxnId } from "./ids";
import { tokens, type TokenAmount } from "./money";

export const HABITS = [
  "habitat",
  "food",
  "transit",
  "work",
  "transfer",
  "unclassified",
] as const;

export type Habit = (typeof HABITS)[number];
export type OutgoingHabit = "habitat" | "food" | "transit" | "unclassified";
export type IncomingHabit = "work" | "unclassified";
export type FlowDirection = "in" | "out" | "internal";
export type ShareBps = number & { readonly __brand: "ShareBps" };

export type DrillView =
  | { kind: "overview" }
  | { kind: "flow"; flow: FlowDirection }
  | { kind: "habit"; habit: Habit }
  | { kind: "movement"; txnId: TxnId };

export type ClassifiedMovement =
  | {
      flow: "out";
      habit: OutgoingHabit;
      transaction: Transaction;
      accountName: string;
    }
  | {
      flow: "in";
      habit: IncomingHabit;
      transaction: Transaction;
      accountName: string;
    }
  | {
      flow: "internal";
      habit: "transfer";
      transaction: Transaction;
      accountName: string;
    };

export type FlowTotals = {
  in: TokenAmount;
  out: TokenAmount;
  internalDebit: TokenAmount;
};

export type HabitRow = {
  habit: Habit;
  label: string;
  out: TokenAmount;
  in: TokenAmount;
  count: number;
  outShare: ShareBps;
};

export type FlowReport = {
  totals: FlowTotals;
  habits: readonly HabitRow[];
  movements: readonly ClassifiedMovement[];
};

export type DrillSlice =
  | { kind: "overview" }
  | {
      kind: "flow";
      flow: FlowDirection;
      total: TokenAmount;
      movements: readonly ClassifiedMovement[];
    }
  | {
      kind: "habit";
      row: HabitRow;
      movements: readonly ClassifiedMovement[];
    }
  | {
      kind: "movement";
      movement: ClassifiedMovement;
      siblings: readonly ClassifiedMovement[];
    }
  | { kind: "missing"; wanted: DrillView };

export type FlowPage = {
  report: FlowReport;
  slice: DrillSlice;
};

const HABIT_SET: ReadonlySet<string> = new Set(HABITS);

const HABIT_LABEL = {
  habitat: "Habitat",
  food: "Food",
  transit: "Transit",
  work: "Work",
  transfer: "Transfers",
  unclassified: "Unclassified",
} as const satisfies Record<Habit, string>;

type HabitRule =
  | {
      flow: "out";
      habit: Exclude<OutgoingHabit, "unclassified">;
      includes: string;
    }
  | {
      flow: "in";
      habit: Exclude<IncomingHabit, "unclassified">;
      includes: string;
    };

const HABIT_RULES: readonly HabitRule[] = [
  { flow: "out", habit: "food", includes: "coffee" },
  { flow: "out", habit: "food", includes: "canteen" },
  { flow: "out", habit: "food", includes: "greenhouse" },
  { flow: "out", habit: "transit", includes: "transit" },
  { flow: "out", habit: "transit", includes: "tram" },
  { flow: "out", habit: "transit", includes: "rover" },
  { flow: "out", habit: "habitat", includes: "habitat" },
  { flow: "out", habit: "habitat", includes: "air and water" },
  { flow: "out", habit: "habitat", includes: "power levy" },
  { flow: "in", habit: "work", includes: "payroll" },
  { flow: "in", habit: "work", includes: "bonus" },
];

export function isHabit(value: string): value is Habit {
  return HABIT_SET.has(value);
}

export function drillFromQuery(query: {
  view?: string;
  flow?: string;
  habit?: string;
  id?: string;
}): DrillView {
  if (query.view === "flow") {
    if (
      query.flow === "in" ||
      query.flow === "out" ||
      query.flow === "internal"
    ) {
      return { kind: "flow", flow: query.flow };
    }
  }
  if (query.view === "habit" && query.habit && isHabit(query.habit)) {
    return { kind: "habit", habit: query.habit };
  }
  if (query.view === "movement" && query.id) {
    return { kind: "movement", txnId: txnId(query.id) };
  }
  return { kind: "overview" };
}

export function flowPage(snapshot: BankSnapshot, drill: DrillView): FlowPage {
  const report = reduceFlow(classifyAll(snapshot));
  return { report, slice: selectSlice(report, drill) };
}

function shareBps(value: number): ShareBps {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new Error("ShareBps must be an integer from 0 to 10000.");
  }
  return value as ShareBps;
}

function shareOf(part: number, whole: number): ShareBps {
  if (whole <= 0) return shareBps(0);
  return shareBps(
    Math.min(10_000, Math.max(0, Math.round((part / whole) * 10_000))),
  );
}

function outgoingHabit(description: string): OutgoingHabit {
  const haystack = description.toLowerCase();
  for (const rule of HABIT_RULES) {
    if (rule.flow === "out" && haystack.includes(rule.includes)) {
      return rule.habit;
    }
  }
  return "unclassified";
}

function incomingHabit(description: string): IncomingHabit {
  const haystack = description.toLowerCase();
  for (const rule of HABIT_RULES) {
    if (rule.flow === "in" && haystack.includes(rule.includes)) {
      return rule.habit;
    }
  }
  return "unclassified";
}

function accountNameOf(
  accounts: readonly Account[],
  accountId: Transaction["accountId"],
): string {
  return (
    accounts.find((account) => account.id === accountId)?.name ??
    "Unknown account"
  );
}

function classifyMovement(
  transaction: Transaction,
  accounts: readonly Account[],
): ClassifiedMovement {
  const accountName = accountNameOf(accounts, transaction.accountId);
  if (transaction.counterpartyAccountId) {
    return {
      flow: "internal",
      habit: "transfer",
      transaction,
      accountName,
    };
  }
  if (transaction.direction === "debit") {
    return {
      flow: "out",
      habit: outgoingHabit(transaction.description),
      transaction,
      accountName,
    };
  }
  return {
    flow: "in",
    habit: incomingHabit(transaction.description),
    transaction,
    accountName,
  };
}

function classifyAll(snapshot: BankSnapshot): ClassifiedMovement[] {
  return snapshot.transactions.map((transaction) =>
    classifyMovement(transaction, snapshot.accounts),
  );
}

function reduceFlow(movements: readonly ClassifiedMovement[]): FlowReport {
  let inbound = 0;
  let outbound = 0;
  let internalDebit = 0;
  const groups = new Map<Habit, { out: number; in: number; count: number }>();

  for (const movement of movements) {
    const group = groups.get(movement.habit) ?? { out: 0, in: 0, count: 0 };
    group.count += 1;
    switch (movement.flow) {
      case "out":
        outbound += movement.transaction.amount;
        group.out += movement.transaction.amount;
        break;
      case "in":
        inbound += movement.transaction.amount;
        group.in += movement.transaction.amount;
        break;
      case "internal":
        if (movement.transaction.direction === "debit") {
          internalDebit += movement.transaction.amount;
          group.out += movement.transaction.amount;
        } else {
          group.in += movement.transaction.amount;
        }
        break;
      default: {
        const _exhaustive: never = movement;
        return _exhaustive;
      }
    }
    groups.set(movement.habit, group);
  }

  const totals: FlowTotals = {
    in: tokens(inbound),
    out: tokens(outbound),
    internalDebit: tokens(internalDebit),
  };

  const habits = HABITS.flatMap((habit) => {
    const group = groups.get(habit);
    if (!group) return [];
    const outShare =
      habit === "transfer"
        ? shareOf(group.out, totals.internalDebit)
        : group.out > 0
          ? shareOf(group.out, totals.out)
          : shareOf(group.in, totals.in);
    return [
      {
        habit,
        label: HABIT_LABEL[habit],
        out: tokens(group.out),
        in: tokens(group.in),
        count: group.count,
        outShare,
      },
    ];
  });

  return { totals, habits, movements };
}

function selectSlice(report: FlowReport, drill: DrillView): DrillSlice {
  switch (drill.kind) {
    case "overview":
      return { kind: "overview" };
    case "flow": {
      const movements = report.movements.filter(
        (movement) => movement.flow === drill.flow,
      );
      const total =
        drill.flow === "in"
          ? report.totals.in
          : drill.flow === "out"
            ? report.totals.out
            : report.totals.internalDebit;
      return { kind: "flow", flow: drill.flow, total, movements };
    }
    case "habit": {
      const row = report.habits.find((item) => item.habit === drill.habit);
      if (!row) return { kind: "missing", wanted: drill };
      return {
        kind: "habit",
        row,
        movements: report.movements.filter(
          (movement) => movement.habit === drill.habit,
        ),
      };
    }
    case "movement": {
      const movement = report.movements.find(
        (item) => item.transaction.id === drill.txnId,
      );
      if (!movement) return { kind: "missing", wanted: drill };
      return {
        kind: "movement",
        movement,
        siblings: report.movements.filter(
          (item) => item.habit === movement.habit,
        ),
      };
    }
    default: {
      const _exhaustive: never = drill;
      return _exhaustive;
    }
  }
}
