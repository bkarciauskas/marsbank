"use client";

import { ArrowLeft, ArrowLeftRight, Check, Copy, Home } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { LoanOffsetPlanner } from "@/components/banking/loan-offset-planner";
import { SpendGroupingPanel } from "@/components/banking/spend-grouping";
import { TransactionList } from "@/components/banking/transaction-list";
import "@/components/banking/reports-surface.css";
import type { Account, CreditAccount } from "@/lib/domain";
import type { SpendGrouping } from "@/lib/flow-report";
import {
  availableBalance,
  creditUtilization,
  displayBalance,
  loanPosition,
  offsetAccounts,
  solCardSpend,
} from "@/lib/ledger";
import { formatTokens } from "@/lib/money";
import { LEDGER_SOL } from "@/lib/sol";
import { useBank } from "@/lib/store";

const percent = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 2,
});

function CreditPanels({
  account,
  spend,
}: {
  account: CreditAccount;
  spend: SpendGrouping;
}) {
  const used = creditUtilization(account);
  const drawn = percent.format(used / 10_000);
  const settle = `/banking/transfer?to=${account.id}`;
  return (
    <>
      <section
        aria-labelledby="credit-utilization-heading"
        className="desk-card"
      >
        <div className="desk-card-heading">
          <div>
            <h2 id="credit-utilization-heading">Credit utilization</h2>
            <p>
              {drawn} of the {formatTokens(account.limit)} limit drawn.
            </p>
          </div>
        </div>
        <div
          aria-label="Credit utilization"
          aria-valuemax={account.limit}
          aria-valuemin={0}
          aria-valuenow={account.owed}
          aria-valuetext={`${drawn} drawn`}
          className="desk-utilization"
          role="meter"
        >
          {used > 0 ? <span style={{ width: `${used / 100}%` }} /> : null}
        </div>
        <div className="desk-planner-actions">
          <p>
            {account.owed > 0
              ? `${formatTokens(account.owed)} owing`
              : "Nothing owing"}
          </p>
          {account.owed > 0 ? (
            <div className="desk-account-actions">
              <Link
                className="desk-primary-action"
                href={`${settle}&amount=${account.owed}`}
              >
                <ArrowLeftRight aria-hidden="true" /> Clear balance
              </Link>
              <Link className="desk-quiet-action" href={settle}>
                Pay custom amount
              </Link>
            </div>
          ) : null}
        </div>
      </section>
      {spend.series.length > 0 ? (
        <SpendGroupingPanel
          copy="Purchases on this card, by habit."
          grouping={spend}
          title={`Sol ${LEDGER_SOL} card spend`}
        />
      ) : null}
    </>
  );
}

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
  const [copied, setCopied] = useState(false);
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

  const coordinates = `${account.branch} · ${account.number}`;
  async function copyCoordinates() {
    await navigator.clipboard.writeText(coordinates);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
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
  const position =
    account.kind === "loan" ? loanPosition(snapshot, account.id) : undefined;
  const repaymentSource = linkedOffsets[0];
  const figure = heroFigure(account);
  const canSend = account.kind !== "loan";
  const canOpenLoan = account.kind === "offset" && linkedLoan;

  return (
    <div className="desk desk-register">
      <Link className="desk-back" href="/banking/accounts">
        <ArrowLeft aria-hidden="true" /> Token register
      </Link>
      <div className="desk-intro">
        <div>
          <h1>{account.name}</h1>
          <p>
            {account.productName} · {coordinates}
            <button
              className="desk-copy"
              onClick={() => void copyCoordinates()}
              type="button"
            >
              {copied ? (
                <Check aria-hidden="true" />
              ) : (
                <Copy aria-hidden="true" />
              )}
              {copied ? "Copied" : "Copy coordinates"}
            </button>
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

      {account.kind === "credit" ? (
        <CreditPanels
          account={account}
          spend={solCardSpend(snapshot, account.id)}
        />
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

      {account.kind === "loan" && position ? (
        <section className="desk-card desk-offset-note">
          <Home aria-hidden="true" />
          <div>
            <span>
              {linkedOffsets.map((offset) => offset.name).join(" · ")}
            </span>
            <strong>
              {formatTokens(position.offset)} working against this habitat
            </strong>
          </div>
        </section>
      ) : null}

      {account.kind === "loan" && position && repaymentSource ? (
        <LoanOffsetPlanner
          loanId={account.id}
          position={position}
          source={repaymentSource}
        />
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
