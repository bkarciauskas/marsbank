import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { Account } from "@/lib/domain";
import { availableBalance } from "@/lib/ledger";
import { formatTokens, tokens } from "@/lib/money";

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

function balanceLabel(account: Account): string {
  switch (account.kind) {
    case "credit":
      return "Owing";
    case "loan":
      return "Remaining";
    default:
      return "Available";
  }
}

function heldLabel(account: Account): string {
  return account.kind === "loan" ? "Offset" : "Held";
}

export function AccountList({
  accounts,
  ledger = accounts,
  compact = false,
}: {
  accounts: Account[];
  ledger?: Account[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "account-list compact" : "account-list"}>
      <div aria-hidden="true" className="account-list-header">
        <span>Ref</span>
        <span>Account</span>
        <span>Registry / account</span>
        <span>Ready (MT)</span>
        <span>Held (MT)</span>
        <span>Position (MT)</span>
        <span />
      </div>
      {accounts.map((account, index) => {
        const values = registerValues(account, ledger);
        return (
          <Link href={`/banking/accounts/${account.id}`} key={account.id}>
            <span className="account-reference">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="account-name">
              <strong>{account.name}</strong>
              <small>{account.productName}</small>
            </span>
            <span className="account-coordinates">
              <small>{account.branch}</small>
              <span>{account.number}</span>
            </span>
            <span className="account-value">
              <small>{balanceLabel(account)}</small>
              <strong>{formatTokens(values.available)}</strong>
            </span>
            <span className="account-value">
              <small>{heldLabel(account)}</small>
              <strong>{formatTokens(values.held)}</strong>
            </span>
            <span className="account-value total">
              <small>Position</small>
              <strong>{formatTokens(values.total)}</strong>
            </span>
            <ArrowUpRight className="account-arrow" />
          </Link>
        );
      })}
    </div>
  );
}
