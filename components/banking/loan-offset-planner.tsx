"use client";

import { ArrowLeftRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { OffsetAccount } from "@/lib/domain";
import type { AccountId } from "@/lib/ids";
import {
  HABITAT_LOAN_TERMS,
  MARS_YEAR_SOLS,
  projectLoan,
  solsSaved,
  type LoanPosition,
  type LoanProjection,
  type Payoff,
} from "@/lib/loan-projection";
import {
  addTokens,
  formatTokens,
  groupTokens,
  parseTokenInput,
  tokens,
  type TokenAmount,
} from "@/lib/money";

const wholeSols = new Intl.NumberFormat("en-AU");
const marsYears = new Intl.NumberFormat("en-AU", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type Entry = { amount: TokenAmount; issue: string | null };

function readEntry(
  raw: string,
  cap?: { max: TokenAmount; issue: string },
): Entry {
  const amount = raw.trim() === "" ? tokens(0) : parseTokenInput(raw);
  if (amount === null) {
    return { amount: tokens(0), issue: "Enter whole tokens, such as 250,000." };
  }
  if (cap && amount > cap.max) return { amount: tokens(0), issue: cap.issue };
  return { amount, issue: null };
}

function PayoffFigure({ payoff }: { payoff: Payoff }) {
  if (payoff.kind === "never") return <>Never at this repayment</>;
  return (
    <>
      {wholeSols.format(payoff.sols)}{" "}
      <small>
        sols · {marsYears.format(payoff.sols / MARS_YEAR_SOLS)} Mars years
      </small>
    </>
  );
}

function PlannerField({
  entry,
  id,
  label,
  note,
  onChange,
  value,
}: {
  entry: Entry;
  id: string;
  label: string;
  note: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="desk-planner-field">
      <label htmlFor={id}>{label}</label>
      <input
        aria-describedby={entry.issue ? `${id}-note ${id}-issue` : `${id}-note`}
        aria-invalid={entry.issue !== null}
        autoComplete="off"
        id={id}
        inputMode="numeric"
        onChange={(event) => onChange(event.target.value)}
        placeholder="0"
        value={value}
      />
      <small id={`${id}-note`}>{note}</small>
      {entry.issue ? (
        <p className="form-error" id={`${id}-issue`} role="alert">
          {entry.issue}
        </p>
      ) : null}
    </div>
  );
}

function ProjectionView({
  id,
  title,
  projection,
}: {
  id: string;
  title: string;
  projection: LoanProjection;
}) {
  const remaining = addTokens(projection.offsetCovers, projection.netPrincipal);
  return (
    <section aria-labelledby={id} className="desk-planner-view">
      <h3 id={id}>{title}</h3>
      <dl className="desk-glance">
        <div>
          <dt>Offset covers</dt>
          <dd>
            {groupTokens(projection.offsetCovers)}{" "}
            <small>of {groupTokens(remaining)} MT remaining</small>
          </dd>
        </div>
        <div>
          <dt>Levy saved per Mars year</dt>
          <dd>
            {groupTokens(projection.levySavedPerMarsYear)} <small>MT</small>
          </dd>
        </div>
        <div>
          <dt>Paid off in</dt>
          <dd>
            <PayoffFigure payoff={projection.payoff} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

export function LoanOffsetPlanner({
  loanId,
  position,
  source,
}: {
  loanId: AccountId;
  position: LoanPosition;
  source: OffsetAccount;
}) {
  const [extraInput, setExtraInput] = useState("");
  const [lumpInput, setLumpInput] = useState("");

  const extra = readEntry(extraInput);
  const lump = readEntry(lumpInput, {
    max: tokens(Math.min(source.available, position.remaining)),
    issue:
      source.available < position.remaining
        ? `${source.name} has ${formatTokens(source.available)} available.`
        : `Only ${formatTokens(position.remaining)} remains on this loan.`,
  });

  const today = projectLoan(position);
  const planned = projectLoan(position, {
    extraOffset: extra.amount,
    repaidFromOffset: lump.amount,
  });
  const sooner = solsSaved(today.payoff, planned.payoff);
  const repayHref = `/banking/transfer?from=${source.id}&to=${loanId}`;
  const levyPercent = HABITAT_LOAN_TERMS.levyBasisPoints / 100;

  return (
    <section aria-labelledby="offset-planner-heading" className="desk-card">
      <div className="desk-card-heading">
        <div>
          <h2 id="offset-planner-heading">Offset planner</h2>
          <p>
            A what-if at a {levyPercent}% levy per Mars year. Nothing moves
            until you send a repayment.
          </p>
        </div>
      </div>
      <ProjectionView
        id="offset-planner-today"
        projection={today}
        title="Today"
      />
      <p className="desk-glance-note">
        {formatTokens(today.netPrincipal)} of net principal carries levy. The
        scheduled repayment is {formatTokens(HABITAT_LOAN_TERMS.repaymentPerSol)}{" "}
        per sol.
      </p>
      <div className="desk-planner-fields">
        <PlannerField
          entry={extra}
          id="planner-extra-offset"
          label="Move into offset"
          note="Tokens arriving from outside your offset accounts. Moves between them change nothing."
          onChange={setExtraInput}
          value={extraInput}
        />
        <PlannerField
          entry={lump}
          id="planner-lump-sum"
          label="Lump-sum payment"
          note={`Paid from ${source.name}, so the offset falls by the same amount.`}
          onChange={setLumpInput}
          value={lumpInput}
        />
      </div>
      <ProjectionView
        id="offset-planner-plan"
        projection={planned}
        title="With this plan"
      />
      <div className="desk-planner-actions">
        <p role="status">
          {sooner !== null && sooner > 0
            ? `${wholeSols.format(sooner)} sols sooner`
            : ""}
        </p>
        {lump.amount > 0 ? (
          <Link
            className="desk-primary-action"
            href={`${repayHref}&amount=${lump.amount}`}
          >
            <ArrowLeftRight aria-hidden="true" /> Repay{" "}
            {formatTokens(lump.amount)}
          </Link>
        ) : (
          <Link className="desk-quiet-action" href={repayHref}>
            <ArrowLeftRight aria-hidden="true" /> Make a repayment
          </Link>
        )}
      </div>
    </section>
  );
}
