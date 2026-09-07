"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AccountList } from "@/components/banking/account-list";
import { formatDaypartGreeting } from "@/lib/daypart";
import { availableBalance } from "@/lib/ledger";
import { formatTokens, tokens } from "@/lib/money";
import {
  LEDGER_SOL,
  latestPostedTime,
  solNumberFromLatest,
  solsBeforeLatest,
} from "@/lib/sol";
import { useBank } from "@/lib/store";
import { useViewerCivilHour } from "@/lib/use-viewer-civil-hour";

export default function BankingOverview() {
  const { snapshot } = useBank();
  const localHour = useViewerCivilHour();
  const greeting =
    localHour === null
      ? null
      : formatDaypartGreeting(snapshot.customer.displayName, localHour);
  const spendableAccounts = snapshot.accounts.filter(
    (account) => account.kind !== "loan",
  );
  const totalAvailable = tokens(
    spendableAccounts.reduce(
      (total, account) => total + availableBalance(account),
      0,
    ),
  );
  const latestPostedAt = latestPostedTime(
    snapshot.transactions.map((transaction) => transaction.postedOn),
  );
  const currentSolTransactions = snapshot.transactions.filter(
    (transaction) => solsBeforeLatest(transaction.postedOn, latestPostedAt) === 0,
  );
  const totalCredits = tokens(
    currentSolTransactions
      .filter((transaction) => transaction.direction === "credit")
      .reduce((total, transaction) => total + transaction.amount, 0),
  );
  const totalDebits = tokens(
    currentSolTransactions
      .filter((transaction) => transaction.direction === "debit")
      .reduce((total, transaction) => total + transaction.amount, 0),
  );
  const netMovement = tokens(totalCredits - totalDebits);
  const grouped = new Intl.NumberFormat("en-AU");
  const recentMovements = snapshot.transactions.slice(0, 5);
  const accountNames = new Map(
    snapshot.accounts.map((account) => [account.id, account.name]),
  );

  return (
    <div className="desk">
      <div className="desk-intro">
        <div>
          <h1 aria-live="polite">{greeting ?? "\u00a0"}</h1>
          <p>
            Mars sol {LEDGER_SOL} · Client {snapshot.customer.memberId}
          </p>
        </div>
        <Link className="desk-primary-action" href="/banking/transfer">
          Make a transfer <ArrowRight />
        </Link>
      </div>

      <section aria-label="Accounts" className="desk-card">
        <AccountList accounts={snapshot.accounts} compact showTotals />
      </section>

      <div className="desk-columns">
        <section aria-labelledby="desk-movements" className="desk-card">
          <div className="desk-card-heading">
            <h2 id="desk-movements">Recent transactions</h2>
            <Link href="/banking/activity">
              View all <ChevronRight />
            </Link>
          </div>
          <ul className="desk-movements">
            {recentMovements.map((transaction) => (
              <li key={transaction.id}>
                <span className="desk-movement-sol">
                  Sol {solNumberFromLatest(transaction.postedOn, latestPostedAt)}
                </span>
                <span className="desk-movement-name">
                  <strong>{transaction.description}</strong>
                  <small>{accountNames.get(transaction.accountId)}</small>
                </span>
                <strong className={`desk-movement-amount ${transaction.direction}`}>
                  {transaction.direction === "debit" ? "−" : "+"}
                  {grouped.format(transaction.amount)} <small>MT</small>
                </strong>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="desk-sol" className="desk-card">
          <div className="desk-card-heading">
            <h2 id="desk-sol">This sol at a glance</h2>
            <Link href="/banking/reports">
              Posted movement <ChevronRight />
            </Link>
          </div>
          <dl className="desk-glance">
            <div>
              <dt>Tokens in</dt>
              <dd className={totalCredits > 0 ? "credit" : undefined}>
                {totalCredits > 0 ? "+" : ""}
                {grouped.format(totalCredits)} <small>MT</small>
              </dd>
            </div>
            <div>
              <dt>Tokens out</dt>
              <dd>
                {totalDebits > 0 ? "−" : ""}
                {grouped.format(totalDebits)} <small>MT</small>
              </dd>
            </div>
            <div>
              <dt>Net change</dt>
              <dd className={netMovement > 0 ? "credit" : undefined}>
                {netMovement > 0 ? "+" : netMovement < 0 ? "−" : ""}
                {grouped.format(Math.abs(netMovement))} <small>MT</small>
              </dd>
            </div>
          </dl>
          <p className="desk-glance-note">
            Posted lines only. {formatTokens(totalAvailable)} remain available
            across your deposit accounts and unused credit.
          </p>
        </section>
      </div>
    </div>
  );
}
