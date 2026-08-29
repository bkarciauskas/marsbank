import { Fragment } from "react";
import type { Transaction } from "@/lib/domain";
import { formatTokens } from "@/lib/money";
import { latestPostedTime, solNumberFromLatest } from "@/lib/sol";

export function TransactionList({
  transactions,
  compact = false,
}: {
  transactions: Transaction[];
  compact?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <div className="empty-state">
        <h3>No movement on this account</h3>
        <p>Your next transfer or card payment will land here, stamped to its sol.</p>
      </div>
    );
  }

  const latestPostedAt = latestPostedTime(
    transactions.map((transaction) => transaction.postedOn),
  );
  const solNumber = (transaction: Transaction) =>
    solNumberFromLatest(transaction.postedOn, latestPostedAt);

  return (
    <div className={compact ? "transaction-list compact" : "transaction-list"}>
      {transactions.map((transaction, index) => {
        const sol = solNumber(transaction);
        const previous = transactions[index - 1];
        const startsSol = !previous || solNumber(previous) !== sol;
        return (
          <Fragment key={transaction.id}>
            {startsSol ? (
              <div className="transaction-sol-heading">Sol {sol}</div>
            ) : null}
            <div className="transaction-row">
              <span className="transaction-date">
                <strong>
                  {new Intl.DateTimeFormat("en-AU", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "UTC",
                  }).format(new Date(transaction.postedOn))}
                </strong>
              </span>
              <span>
                <strong>{transaction.description}</strong>
                <small>
                  {transaction.direction === "debit" ? "Debit" : "Credit"}
                </small>
              </span>
              <strong className={transaction.direction}>
                {transaction.direction === "debit" ? "−" : "+"}
                {formatTokens(transaction.amount)}
              </strong>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
