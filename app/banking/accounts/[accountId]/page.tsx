"use client";

import { ArrowLeft, ArrowLeftRight, Copy, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { TransactionList } from "@/components/banking/transaction-list";
import type { Account } from "@/lib/domain";
import {
  availableBalance,
  displayBalance,
  offsetAccounts,
  offsetTotal,
} from "@/lib/ledger";
import { formatTokens } from "@/lib/money";
import { useBank } from "@/lib/store";

function heroFigure(account: Account): { label: string; spendable: boolean } {
  switch (account.kind) {
    case "credit":
      return { label: "Owing", spendable: false };
    case "loan":
      return { label: "Remaining", spendable: false };
    case "transaction":
    case "savings":
    case "offset":
      return { label: "Available", spendable: true };
  }
}

export default function AccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const { snapshot } = useBank();
  const account = snapshot.accounts.find(
    (candidate) => candidate.id === params.accountId,
  );

  if (!account) {
    return (
      <div className="desk">
        <div className="empty-state large">
          <h1>This account is off the register</h1>
          <Link className="desk-primary-action" href="/banking/accounts">
            Return to your token register
          </Link>
        </div>
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
  const figure = heroFigure(account);
  const canSend = account.kind !== "loan";
  const canOpenLoan = account.kind === "offset" && linkedLoan;

  return (
    <div className="desk">
      <Link className="desk-back" href="/banking/accounts">
        <ArrowLeft aria-hidden="true" /> Token register
      </Link>
      <div className="desk-intro">
        <div>
          <h1>{account.name}</h1>
          <p>
            {account.productName} · {account.branch} · {account.number}{" "}
            <Copy aria-hidden="true" />
          </p>
        </div>
        <div
          className={
            figure.spendable ? "desk-position spendable" : "desk-position"
          }
        >
          <div>
            <span>{figure.label}</span>
            <strong>{formatTokens(displayBalance(account))}</strong>
            {account.kind === "credit" ? (
              <small>{formatTokens(availableBalance(account))} available</small>
            ) : null}
          </div>
        </div>
      </div>

      {canSend || canOpenLoan ? (
        <div className="desk-account-actions">
          {canSend ? (
            <Link
              className="desk-primary-action"
              href={`/banking/transfer?from=${account.id}`}
            >
              <ArrowLeftRight aria-hidden="true" /> Send tokens
            </Link>
          ) : null}
          {linkedLoan ? (
            <Link
              className="desk-quiet-action"
              href={`/banking/accounts/${linkedLoan.id}`}
            >
              <Home aria-hidden="true" /> Open habitat loan
            </Link>
          ) : null}
        </div>
      ) : null}

      {account.kind === "offset" && linkedLoan ? (
        <section className="desk-card desk-offset-note">
          <Home aria-hidden="true" />
          <div>
            <span>Working against {linkedLoan.name}</span>
            <strong>
              {formatTokens(displayBalance(account))} reducing the loan balance
            </strong>
          </div>
        </section>
      ) : null}

      {account.kind === "loan" && linkedOffsetTotal !== undefined ? (
        <section className="desk-card desk-offset-note">
          <Home aria-hidden="true" />
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

      <section className="desk-card">
        <div className="desk-card-heading">
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
