import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Account } from "@/lib/domain";
import { availableBalance } from "@/lib/ledger";
import { groupTokens, tokens } from "@/lib/money";

function registerValues(account: Account, accounts: Account[]) {
  switch (account.kind) {
    case "transaction":
    case "savings":
    case "offset":
      return {
        available: account.available,
        held: tokens(account.current - account.available),
        total: account.current,
      };
    case "credit":
      return {
        available: availableBalance(account),
        held: account.owed,
        total: account.limit,
      };
    case "loan": {
      const offsetting = accounts.reduce(
        (total, candidate) =>
          candidate.kind === "offset" && candidate.linkedLoanId === account.id
            ? total + candidate.current
            : total,
        0,
      );
      return {
        available: account.remaining,
        held: tokens(offsetting),
        total: account.principal,
      };
    }
  }
}

/**
 * Column headers read Available / Held / Total. A loan and a credit line put
 * different quantities in those slots, so each row states its own words and only
 * genuinely spendable money is plotted in signal blue.
 */
function columnLabels(account: Account): {
  available: string;
  held: string;
  total: string;
} {
  switch (account.kind) {
    case "credit":
      return { available: "Available credit", held: "Owing", total: "Limit" };
    case "loan":
      return { available: "Remaining", held: "Offset", total: "Original" };
    default:
      return { available: "Available", held: "Held", total: "Total" };
  }
}

function isSpendable(account: Account): boolean {
  return account.kind !== "loan";
}

export function AccountList({
  accounts,
  ledger = accounts,
  compact = false,
  showTotals = false,
}: {
  accounts: Account[];
  ledger?: Account[];
  compact?: boolean;
  showTotals?: boolean;
}) {
  const spendable = accounts.filter((account) => account.kind !== "loan");
  const totalAvailable = tokens(
    spendable.reduce((total, account) => total + availableBalance(account), 0),
  );
  const depositBalance = tokens(
    accounts.reduce(
      (total, account) =>
        account.kind === "transaction" ||
        account.kind === "savings" ||
        account.kind === "offset"
          ? total + account.current
          : total,
      0,
    ),
  );

  return (
    <div className={compact ? "account-list compact" : "account-list"}>
      <div aria-hidden="true" className="account-list-header">
        <span>Account</span>
        <span>Branch and number</span>
        <span>Available (MT)</span>
        <span>Held (MT)</span>
        <span>Total (MT)</span>
        <span />
      </div>
      {accounts.map((account) => {
        const values = registerValues(account, ledger);
        const labels = columnLabels(account);
        const restated = labels.available !== "Available";
        return (
          <Link href={`/banking/accounts/${account.id}`} key={account.id}>
            <span className="account-name">
              <strong>{account.name}</strong>
              <small>{account.productName}</small>
            </span>
            <span className="account-coordinates">
              <small>{account.branch}</small>
              <span>{account.number}</span>
            </span>
            <span
              className={
                isSpendable(account)
                  ? "account-value spendable"
                  : "account-value restated"
              }
            >
              <small className={restated ? "is-restated" : undefined}>
                {labels.available}
              </small>
              <strong>{groupTokens(values.available)}</strong>
            </span>
            <span className="account-value">
              <small className={restated ? "is-restated" : undefined}>
                {labels.held}
              </small>
              <strong>{groupTokens(values.held)}</strong>
            </span>
            <span className="account-value total">
              <small className={restated ? "is-restated" : undefined}>
                {labels.total}
              </small>
              <strong>{groupTokens(values.total)}</strong>
            </span>
            <ChevronRight className="account-arrow" />
          </Link>
        );
      })}
      {showTotals ? (
        <div className="account-list-totals">
          <span>
            Available spans deposits plus unused credit. Loan balances are debt
            and count toward neither figure.
          </span>
          <span>
            <small>Total available (MT)</small>
            <strong>{groupTokens(totalAvailable)}</strong>
          </span>
          <span>
            <small>Deposit balance (MT)</small>
            <strong>{groupTokens(depositBalance)}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}
