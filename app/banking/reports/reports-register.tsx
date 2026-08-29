"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { TransactionList } from "@/components/banking/transaction-list";
import type { Transaction } from "@/lib/domain";
import {
  flowPage,
  type ClassifiedMovement,
  type DrillView,
  type FlowDirection,
  type HabitRow,
} from "@/lib/flow-report";
import { formatTokens } from "@/lib/money";
import { latestPostedTime, solNumberFromLatest } from "@/lib/sol";
import { useBank } from "@/lib/store";
import "@/components/banking/reports-surface.css";

const FLOW_LABEL = {
  in: "Tokens in",
  out: "Tokens out",
  internal: "Internal",
} as const satisfies Record<FlowDirection, string>;

function habitFigures(row: HabitRow): string {
  if (row.out > 0 && row.in > 0) {
    return `−${formatTokens(row.out)}  +${formatTokens(row.in)}`;
  }
  if (row.out > 0) return `−${formatTokens(row.out)}`;
  return `+${formatTokens(row.in)}`;
}

function movementsOf(
  classified: readonly ClassifiedMovement[],
): Transaction[] {
  return classified.map((movement) => movement.transaction);
}

export function ReportsRegister({ drill }: { drill: DrillView }) {
  const { snapshot } = useBank();
  const page = flowPage(snapshot, drill);
  const latestPostedAt = latestPostedTime(
    snapshot.transactions.map((transaction) => transaction.postedOn),
  );

  return (
    <>
      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Flow totals</h2>
            <p>
              These totals are posted movement, not a reconstruction of
              available tokens.
            </p>
          </div>
          <Link className="reports-ledger-link" href="/banking/activity">
            Open full ledger <ArrowRight />
          </Link>
        </div>
        <dl className="flow-totals">
          <div>
            <Link href="/banking/reports?view=flow&flow=in">
              <dt>{FLOW_LABEL.in}</dt>
              <dd>{formatTokens(page.report.totals.in)}</dd>
            </Link>
          </div>
          <div>
            <Link href="/banking/reports?view=flow&flow=out">
              <dt>{FLOW_LABEL.out}</dt>
              <dd>−{formatTokens(page.report.totals.out)}</dd>
            </Link>
          </div>
          <div>
            <Link href="/banking/reports?view=flow&flow=internal">
              <dt>{FLOW_LABEL.internal}</dt>
              <dd>{formatTokens(page.report.totals.internalDebit)}</dd>
            </Link>
          </div>
        </dl>
      </section>

      <section className="bank-section">
        <div className="bank-section-heading">
          <div>
            <h2>Habits</h2>
          </div>
        </div>
        <ul className="habit-register">
          {page.report.habits.map((row) => (
            <li key={row.habit}>
              <Link href={`/banking/reports?view=habit&habit=${row.habit}`}>
                <span>{row.label}</span>
                <strong>{habitFigures(row)}</strong>
                <span className="habit-share" aria-hidden="true">
                  <span style={{ width: `${row.outShare / 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {page.slice.kind === "flow" ? (
        <section className="bank-section">
          <div className="bank-section-heading">
            <div>
              <h2>{FLOW_LABEL[page.slice.flow]}</h2>
              <p>{formatTokens(page.slice.total)} posted on this flow.</p>
            </div>
            <Link href="/banking/reports">All posted movement</Link>
          </div>
          <TransactionList transactions={movementsOf(page.slice.movements)} />
        </section>
      ) : null}

      {page.slice.kind === "habit" ? (
        <section className="bank-section">
          <div className="bank-section-heading">
            <div>
              <h2>{page.slice.row.label}</h2>
              <p>
                {page.slice.row.count === 1
                  ? "1 posted line."
                  : `${page.slice.row.count} posted lines.`}
              </p>
            </div>
            <Link href="/banking/reports">All posted movement</Link>
          </div>
          <TransactionList transactions={movementsOf(page.slice.movements)} />
        </section>
      ) : null}

      {page.slice.kind === "movement" ? (
        <section className="bank-section">
          <div className="bank-section-heading">
            <div>
              <h2>{page.slice.movement.transaction.description}</h2>
              <p>
                {page.slice.movement.accountName} · Sol{" "}
                {solNumberFromLatest(
                  page.slice.movement.transaction.postedOn,
                  latestPostedAt,
                )}
              </p>
            </div>
            <Link href="/banking/reports">All posted movement</Link>
          </div>
          <TransactionList transactions={movementsOf(page.slice.siblings)} />
        </section>
      ) : null}

      {page.slice.kind === "missing" ? (
        <section className="bank-section">
          <div className="bank-section-heading">
            <div>
              <h2>Not on this register</h2>
              <p>That slice is not in the posted lines for this resident.</p>
            </div>
            <Link href="/banking/reports">All posted movement</Link>
          </div>
        </section>
      ) : null}
    </>
  );
}
