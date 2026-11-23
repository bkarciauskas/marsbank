import type { Account, BankSnapshot, Transaction } from "./domain";

function accountName(accounts: readonly Account[], id: Account["id"]): string {
  return accounts.find((account) => account.id === id)?.name ?? "";
}

function searchableFields(
  accounts: readonly Account[],
  transaction: Transaction,
): string[] {
  const fields = [
    transaction.description,
    accountName(accounts, transaction.accountId),
  ];
  if (transaction.counterpartyAccountId) {
    fields.push(accountName(accounts, transaction.counterpartyAccountId));
  }
  if (transaction.payee) {
    fields.push(transaction.payee.displayName, transaction.payee.institution);
  }
  return fields;
}

export function transactionsMatchingSearch(
  snapshot: Pick<BankSnapshot, "transactions" | "accounts">,
  query: string,
): Transaction[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) {
    return [...snapshot.transactions];
  }
  return snapshot.transactions.filter((transaction) =>
    searchableFields(snapshot.accounts, transaction).some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}