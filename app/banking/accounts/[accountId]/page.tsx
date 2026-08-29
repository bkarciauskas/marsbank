"use client";

import { ArrowLeft, ArrowLeftRight, Copy, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TransactionList } from "@/components/banking/transaction-list";
import {
  availableBalance,
  displayBalance,
  offsetAccounts,
  offsetTotal,
} from "@/lib/ledger";
import { formatTokens } from "@/lib/money";
import { useBank } from "@/lib/store";

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const { snapshot } = useBank();
  const account = snapshot.accounts.find(
    (candidate) => candidate.id === params.accountId,
  );

  if (!account) {
    return (
      <div className="empty-state large">
        <h1>This account is off the register</h1>
        <Link href="/banking/accounts">Return to your token register</Link>
      </div>
    );
  }

  const transactions = snapshot.transactions.filter(
    (transaction) => transaction.accountId === account.id,
  );
  const linkedLoan =
    account.kind === "offset"
      ? snapshot.accounts.find(
          (candidate) => candidate.id === account.linkedLoanId,
        )
      : undefined;
  const linkedOffsets =
    account.kind === "loan" ? offsetAccounts(snapshot, account.id) : [];
  const linkedOffsetTotal =
    account.kind === "loan" ? offsetTotal(snapshot, account.id) : undefined;

  return (
    <div>
      <Link className="back-link" href="/banking/accounts">
        <ArrowLeft /> Token register
      </Link>
      <div className="account-detail-hero">
        <div>
          <h1>{account.name}</h1>
          <span>
            {account.productName} · {account.branch} · {account.number} <Copy />
          </span>
        </div>
        <div className="detail-balance">
          <span>
            {account.kind === "credit"
              ? "Owing"
              : account.kind === "loan"
                ? "Remaining"
                : "Available"}
          </span>
          <strong>{formatTokens(displayBalance(account))}</strong>
          {account.kind === "credit" ? (
            <small>{formatTokens(availableBalance(account))} available</small>
          ) : null}
        </div>
      </div>

      <div className="detail-actions">
        {account.kind !== "loan" ? (
          <Link href={`/banking/transfer?from=${account.id}`}>
            <ArrowLeftRight /> Send tokens
          </Link>
        ) : null}
        {account.kind === "offset" && linkedLoan ? (
          <Link href={`/banking/accounts/${linkedLoan.id}`}>
            <Home /> Open habitat loan
          </Link>
        ) : null}
      </div>

      {account.kind === "offset" && linkedLoan ? (
        <section className="offset-callout">
          <Home />
          <div>
            <span>Working against {linkedLoan.name}</span>
            <strong>
              {formatTokens(displayBalance(account))} reducing the loan balance
            </strong>
          </div>
        </section>
      ) : null}

      {account.kind === "loan" && linkedOffsetTotal !== undefined ? (
        <section className="offset-callout">
          <Home />
          <div>
            <span>
              {linkedOffsets.map((offset) => offset.name).join(" · ")}
            </span>
            <strong>
              {formatTokens(linkedOffsetTotal)} working against this habitat
            </strong>
          </div>
        </section>
      ) : null}

      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Account movement</h2>
            <p>Every posted token movement, stamped to its sol.</p>
          </div>
        </div>
        <TransactionList transactions={transactions} />
      </section>
    </div>
  );
}
