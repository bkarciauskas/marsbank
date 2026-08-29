import type {
  Account,
  BankSnapshot,
  CardStatus,
  OffsetAccount,
  PayIdTransferCommand,
  TransferCommand,
  TransferResult,
} from "./domain";
import type { AccountId, CardId } from "./ids";
import { txnId } from "./ids";
import { addTokens, subtractTokens, tokens, type TokenAmount } from "./money";
import { payIdLabel } from "./payid";

export function availableBalance(account: Account): TokenAmount {
  switch (account.kind) {
    case "transaction":
    case "savings":
    case "offset":
      return account.available;
    case "credit":
      return subtractTokens(account.limit, account.owed);
    case "loan":
      return tokens(0);
  }
}

export function displayBalance(account: Account): TokenAmount {
  switch (account.kind) {
    case "transaction":
    case "savings":
    case "offset":
      return account.current;
    case "credit":
      return account.owed;
    case "loan":
      return account.remaining;
  }
}

function debit(account: Account, amount: TokenAmount): Account | null {
  switch (account.kind) {
    case "transaction":
    case "savings":
      if (account.available < amount) return null;
      return {
        ...account,
        available: subtractTokens(account.available, amount),
        current: subtractTokens(account.current, amount),
      };
    case "offset":
      if (account.available < amount) return null;
      return {
        ...account,
        available: subtractTokens(account.available, amount),
        current: subtractTokens(account.current, amount),
      };
    case "credit":
      if (addTokens(account.owed, amount) > account.limit) return null;
      return { ...account, owed: addTokens(account.owed, amount) };
    case "loan":
      return null;
  }
}

function credit(account: Account, amount: TokenAmount): Account {
  switch (account.kind) {
    case "transaction":
    case "savings":
      return {
        ...account,
        available: addTokens(account.available, amount),
        current: addTokens(account.current, amount),
      };
    case "offset":
      return {
        ...account,
        available: addTokens(account.available, amount),
        current: addTokens(account.current, amount),
      };
    case "credit":
      return { ...account, owed: tokens(Math.max(0, account.owed - amount)) };
    case "loan":
      return {
        ...account,
        remaining: tokens(Math.max(0, account.remaining - amount)),
      };
  }
}

export function applyTransfer(
  snapshot: BankSnapshot,
  command: TransferCommand,
  now = new Date(),
): TransferResult {
  if (command.from === command.to) return { kind: "same-account" };
  if (command.amount <= 0) return { kind: "amount-not-positive" };

  const source = snapshot.accounts.find((account) => account.id === command.from);
  const destination = snapshot.accounts.find(
    (account) => account.id === command.to,
  );
  if (!source || !destination) return { kind: "unknown-account" };
  if (source.kind === "loan") return { kind: "loan-not-source" };

  const debited = debit(source, command.amount);
  if (!debited) {
    return source.kind === "credit"
      ? { kind: "credit-limit" }
      : { kind: "insufficient-funds" };
  }

  const credited = credit(destination, command.amount);
  const transferId = `${now.getTime()}-${command.from}-${command.to}`;
  const description = command.description.trim() || `Transfer to ${destination.name}`;

  return {
    kind: "ok",
    snapshot: {
      ...snapshot,
      revision: snapshot.revision + 1,
      accounts: snapshot.accounts.map((account) => {
        if (account.id === debited.id) return debited;
        if (account.id === credited.id) return credited;
        return account;
      }),
      transactions: [
        {
          id: txnId(`${transferId}-out`),
          accountId: source.id,
          postedOn: now.toISOString(),
          description,
          amount: command.amount,
          direction: "debit",
          counterpartyAccountId: destination.id,
        },
        {
          id: txnId(`${transferId}-in`),
          accountId: destination.id,
          postedOn: now.toISOString(),
          description: `Transfer from ${source.name}`,
          amount: command.amount,
          direction: "credit",
          counterpartyAccountId: source.id,
        },
        ...snapshot.transactions,
      ],
    },
  };
}

export function applyPayIdTransfer(
  snapshot: BankSnapshot,
  command: PayIdTransferCommand,
  now = new Date(),
): TransferResult {
  if (!command.payee.id) return { kind: "invalid-payid" };
  if (command.amount <= 0) return { kind: "amount-not-positive" };

  const source = snapshot.accounts.find((account) => account.id === command.from);
  if (!source) return { kind: "unknown-account" };
  if (source.kind === "loan") return { kind: "loan-not-source" };

  const debited = debit(source, command.amount);
  if (!debited) {
    return source.kind === "credit"
      ? { kind: "credit-limit" }
      : { kind: "insufficient-funds" };
  }

  const transferId = `${now.getTime()}-${command.from}-${command.payee.id}`;
  const description =
    command.description.trim() ||
    `${payIdLabel(command.payee)} · ${command.payee.displayName}`;

  return {
    kind: "ok",
    snapshot: {
      ...snapshot,
      revision: snapshot.revision + 1,
      accounts: snapshot.accounts.map((account) =>
        account.id === debited.id ? debited : account,
      ),
      transactions: [
        {
          id: txnId(`${transferId}-out`),
          accountId: source.id,
          postedOn: now.toISOString(),
          description,
          amount: command.amount,
          direction: "debit",
          payee: command.payee,
        },
        ...snapshot.transactions,
      ],
    },
  };
}

export function applyIncomingResidentTransfer(
  snapshot: BankSnapshot,
  {
    amount,
    description,
    requestId,
    senderEmail,
    senderName,
  }: {
    amount: TokenAmount;
    description: string;
    requestId: string;
    senderEmail: string;
    senderName: string;
  },
  now = new Date(),
): BankSnapshot {
  const destination = snapshot.accounts.find(
    (account) => account.id === "acc-everyday",
  );
  if (!destination || destination.kind === "loan") {
    return snapshot;
  }

  const credited = credit(destination, amount);
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    accounts: snapshot.accounts.map((account) =>
      account.id === credited.id ? credited : account,
    ),
    transactions: [
      {
        id: txnId(`${requestId}-in`),
        accountId: destination.id,
        postedOn: now.toISOString(),
        description: description.trim() || `Transfer from ${senderName}`,
        amount,
        direction: "credit",
        payee: {
          scheme: "payid",
          id: senderEmail,
          displayName: senderName,
          institution: "Mars Bank",
        },
      },
      ...snapshot.transactions,
    ],
  };
}

export function setCardStatus(
  snapshot: BankSnapshot,
  cardId: CardId,
  status: CardStatus,
): BankSnapshot {
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    cards: snapshot.cards.map((card) =>
      card.id === cardId ? { ...card, status } : card,
    ),
  };
}

export function accountById(
  snapshot: BankSnapshot,
  accountId: AccountId,
): Account | undefined {
  return snapshot.accounts.find((account) => account.id === accountId);
}

export function offsetAccounts(
  snapshot: BankSnapshot,
  loanId: AccountId,
): OffsetAccount[] {
  return snapshot.accounts.filter(
    (account): account is OffsetAccount =>
      account.kind === "offset" && account.linkedLoanId === loanId,
  );
}

export function offsetTotal(
  snapshot: BankSnapshot,
  loanId: AccountId,
): TokenAmount {
  return tokens(
    offsetAccounts(snapshot, loanId).reduce(
      (total, account) => total + account.current,
      0,
    ),
  );
}
