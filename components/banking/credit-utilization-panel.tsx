"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import type { Account, CreditAccount } from "@/lib/domain";
import {
  creditUtilization,
  type CurrentSolCardSpend,
} from "@/lib/ledger";
import { formatTokens, groupTokens } from "@/lib/money";

function formatBpsPercent(bps: number): string {
  const percent = bps / 100;
  if (percent === 0) return "0%";
  if (percent % 1 === 0) return `${percent.toFixed(0)}%`;
  return `${Number(percent.toFixed(2))}%`;
}

export function CreditUtilizationPanel({
  account,
  cardSpend,
  source,
}: {
  account: CreditAccount;
  cardSpend: CurrentSolCardSpend;
  source?: Account;
}) {
  const utilization = creditUtilization(account);
  const percentLabel = formatBpsPercent(utilization.utilizationBps);
  const highUtilization = utilization.utilizationBps >= 8_000;
  const customPayHref = source
    ? `/banking/transfer?from=${source.id}&to=${account.id}`
    : undefined;
  const clearHref =
    source && utilization.owed > 0
      ? `${customPayHref}&amount=${utilization.owed}`
      : undefined;

  return (
    <section
      aria-labelledby="credit-utilization-heading"
      className="desk-card"
    >
      <div className="desk-card-heading">
        <div>
          <h2 id="credit-utilization-heading">Credit utilization</h2>
          <p>
            {formatTokens(utilization.owed)} owing of{" "}
            {formatTokens(utilization.limit)} limit
          </p>
        </div>
      </div>

      <div className="desk-utilization-meter">
        <div
          aria-label="Credit utilization"
          aria-valuemax={utilization.limit}
          aria-valuemin={0}
          aria-valuenow={utilization.owed}
          aria-valuetext={`${percentLabel} used (${formatTokens(utilization.owed)} of ${formatTokens(utilization.limit)})`}
          className="desk-utilization-track"
          role="progressbar"
        >
          <div
            className={
              highUtilization
                ? "desk-utilization-fill is-high"
                : "desk-utilization-fill"
            }
            style={{
              width: `${utilization.utilizationBps / 100}%`,
              minWidth: utilization.owed > 0 ? "4px" : "0",
            }}
          />
        </div>
      </div>

      <dl className="desk-glance">
        <div>
          <dt>Used</dt>
          <dd>{percentLabel}</dd>
        </div>
        <div>
          <dt>Owing</dt>
          <dd>
            {groupTokens(utilization.owed)} <small>MT</small>
          </dd>
        </div>
        <div>
          <dt>Available credit</dt>
          <dd className="credit">
            {groupTokens(utilization.available)} <small>MT</small>
          </dd>
        </div>
      </dl>

      <section
        aria-labelledby="credit-sol-spend-heading"
        className="desk-credit-spend"
      >
        <div className="desk-credit-spend-header">
          <h3 id="credit-sol-spend-heading">
            Sol {cardSpend.solNumber} card spend
          </h3>
          <span>{formatTokens(cardSpend.total)}</span>
        </div>
        {cardSpend.items.length === 0 ? (
          <p className="desk-credit-empty">
            No card spend posted in Sol {cardSpend.solNumber}.
          </p>
        ) : (
          <ul className="desk-credit-spend-list">
            {cardSpend.items.map((item) => (
              <li key={item.id}>
                <div className="desk-credit-spend-row">
                  <span>{item.description}</span>
                  <span className="desk-credit-spend-share">
                    {formatBpsPercent(item.shareBps)}
                  </span>
                  <strong>−{formatTokens(item.amount)}</strong>
                </div>
                <div className="desk-credit-spend-bar" aria-hidden="true">
                  <div style={{ width: `${item.shareBps / 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="desk-planner-actions">
        <p role="status">
          {utilization.owed === 0
            ? "Balance settled · 0 tokens owing"
            : source
              ? `Settle from ${source.name}`
              : "No deposit account available for settlement."}
        </p>
        {source ? (
          <div className="desk-account-actions">
            {clearHref ? (
              <Link className="desk-primary-action" href={clearHref}>
                <ArrowLeftRight aria-hidden="true" /> Clear balance
              </Link>
            ) : (
              <button className="desk-primary-action" disabled type="button">
                <ArrowLeftRight aria-hidden="true" /> Clear balance
              </button>
            )}
            {customPayHref ? (
              <Link className="desk-quiet-action" href={customPayHref}>
                Pay custom amount
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
