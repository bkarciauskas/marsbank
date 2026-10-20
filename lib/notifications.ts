import type { BankSnapshot } from "./domain";
import type { TxnId } from "./ids";
import type { TokenAmount } from "./money";

export type IncomingTransfer = {
  id: TxnId;
  postedOn: string;
  amount: TokenAmount;
  senderName: string;
  senderEmail: string;
  description: string;
};

/** ISO `postedOn` of the newest incoming transfer the resident has read. */
export type ReadThrough = string | null;

/**
 * Credits another resident posted to this register, newest first. Only
 * `applyIncomingResidentTransfer` writes a credit that carries a payee.
 */
export function incomingTransfers(snapshot: BankSnapshot): IncomingTransfer[] {
  return snapshot.transactions
    .filter((txn) => txn.direction === "credit" && txn.payee !== undefined)
    .map((txn) => ({
      id: txn.id,
      postedOn: txn.postedOn,
      amount: txn.amount,
      senderName: txn.payee?.displayName ?? "",
      senderEmail: txn.payee?.id ?? "",
      description: txn.description,
    }))
    .sort((left, right) => right.postedOn.localeCompare(left.postedOn));
}

export function isUnread(
  transfer: IncomingTransfer,
  readThrough: ReadThrough,
): boolean {
  return readThrough === null || transfer.postedOn > readThrough;
}

export function unreadCount(
  feed: readonly IncomingTransfer[],
  readThrough: ReadThrough,
): number {
  return feed.filter((transfer) => isUnread(transfer, readThrough)).length;
}

/** Never moves backwards, so a stale feed cannot un-read a newer credit. */
export function markAllRead(
  feed: readonly IncomingTransfer[],
  readThrough: ReadThrough,
): ReadThrough {
  const newest = feed.reduce<ReadThrough>(
    (latest, transfer) =>
      latest === null || transfer.postedOn > latest ? transfer.postedOn : latest,
    null,
  );
  if (newest === null) return readThrough;
  if (readThrough === null) return newest;
  return newest > readThrough ? newest : readThrough;
}
