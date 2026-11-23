import { ArrowLeftRight, CreditCard } from "lucide-react";
import Link from "next/link";
import type { CreditAccount } from "@/lib/domain";
import { creditUtilization, type SolCardSpend } from "@/lib/ledger";
import { formatTokens, groupTokens } from "@/lib/money";

const percent = new Intl.NumberFormat("en-AU", {
  style: "percent",
  maximumFractionDigits: 2,
});

export function CreditSettlement({
  account,
  spend,
}: {
  account: CreditAccount;
  spend: SolCardSpend;
}) {
  const utilization = creditUtilization(account);
  const transferHref = `/banking/transfer?to=${account.id}`;

  return (
    <section aria-labelledby="credit-settlement-heading" className="desk-card">
      <div className="desk-card-heading">
        <div>
          <h2 id="credit-settlement-heading">Credit utilization</h2>
          <p>
            {formatTokens(account.owed)} owed of a{" "}
            {formatTokens(account.limit)} limit.
          </p>
        </div>
      </div>
      <div className="desk-credit-meter">
        <div
          aria-label="Credit utilization"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={utilization * 100}
          aria-valuetext={percent.format(utilization)}
          className="desk-credit-meter-track"
          role="meter"
        >
          <span style={{ width: `${utilization * 100}%` }} />
        </div>
        <strong>{percent.format(utilization)}</strong>
      </div>
      <div className="desk-planner-actions">
        <p>Settle from your own accounts. Nothing moves until you send.</p>
        <div className="desk-account-actions">
          {account.owed > 0 ? (
            <Link
              className="desk-primary-action"
              href={`${transferHref}&amount=${account.owed}`}
            >
              <ArrowLeftRight aria-hidden="true" /> Clear balance
            </Link>
          ) : null}
          <Link className="desk-quiet-action" href={transferHref}>
            Pay custom amount
          </Link>
        </div>
      </div>
      <section
        aria-labelledby="credit-sol-spend-heading"
        className="desk-credit-spend"
      >
        <h3 id="credit-sol-spend-heading">
          <CreditCard aria-hidden="true" /> Card spend this sol
          <strong>
            {groupTokens(spend.total)} <small>MT</small>
          </strong>
        </h3>
        {spend.purchases.length > 0 ? (
          <ul>
            {spend.purchases.map((purchase) => (
              <li key={purchase.id}>
                <span>{purchase.description}</span>
                <strong>{formatTokens(purchase.amount)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p>No card spend this sol.</p>
        )}
      </section>
    </section>
  );
}
