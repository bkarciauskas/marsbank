"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { AccountList } from "@/components/banking/account-list";
import { TransactionList } from "@/components/banking/transaction-list";
import { availableBalance } from "@/lib/ledger";
import { formatTokens, tokens } from "@/lib/money";
import { latestPostedTime, solsBeforeLatest } from "@/lib/sol";
import { useBank } from "@/lib/store";
import "@/components/banking/reports-surface.css";

export default function BankingOverview() {
  const { snapshot } = useBank();
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
  const formattedTotal = new Intl.NumberFormat("en-AU").format(totalAvailable);

  return (
    <div className="dashboard">
      <div className="page-intro">
        <h1>Good evening, {snapshot.customer.displayName}</h1>
        <p className="mars-time">Sol 21 · Jezero local</p>
      </div>

      <section className="position-panel">
        <div>
          <strong>
            {formattedTotal} <small>Tokens</small>
          </strong>
        </div>
        <Link href="/banking/transfer">
          Send tokens <ArrowRight />
        </Link>
      </section>

      <div className="registry-layout">
        <section className="bank-section account-register">
          <div className="bank-section-heading">
            <div>
              <h2>Accounts</h2>
            </div>
            <Link href="/banking/accounts">
              Open full register <ArrowRight />
            </Link>
          </div>
          <AccountList accounts={snapshot.accounts} compact />
        </section>

        <aside className="bank-section movement-rail">
          <div className="bank-section-heading">
            <div>
              <h2>Latest movement</h2>
            </div>
            <nav aria-label="Movement overflow" className="heading-links">
              <Link href="/banking/activity">
                Open full ledger <ArrowRight />
              </Link>
              <Link href="/banking/reports">
                Posted movement <ArrowRight />
              </Link>
            </nav>
          </div>
          <TransactionList compact transactions={snapshot.transactions.slice(0, 5)} />
        </aside>
      </div>

      <div className="register-summary">
        <section>
          <div className="bank-section-heading">
            <div>
              <h2>Position by account</h2>
            </div>
          </div>
          <ul>
            {spendableAccounts.map((account, index) => (
              <li key={account.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{account.name}</strong>
                <span>{formatTokens(availableBalance(account))}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="sol-summary">
          <div className="bank-section-heading">
            <div>
              <h2>Sol 21 movement</h2>
            </div>
          </div>
          <dl>
            <div>
              <dt>Tokens in</dt>
              <dd>{formatTokens(totalCredits)}</dd>
            </div>
            <div>
              <dt>Tokens out</dt>
              <dd>−{formatTokens(totalDebits)}</dd>
            </div>
            <div>
              <dt>Net change</dt>
              <dd>{formatTokens(netMovement)}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
