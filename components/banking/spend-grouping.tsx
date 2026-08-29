import Link from "next/link";
import type { SpendGrouping, SpendSeries } from "@/lib/flow-report";
import { formatTokens } from "@/lib/money";

const HABIT_SWATCH = {
  habitat: "var(--blue)",
  food: "var(--oxide)",
  transit: "var(--paper)",
  unclassified: "var(--muted)",
} as const;

const AXIS_SWATCH = [
  "var(--blue)",
  "var(--oxide)",
  "var(--paper)",
  "var(--muted)",
] as const;

function habitSwatch(key: string): string | undefined {
  if (
    key === "habitat" ||
    key === "food" ||
    key === "transit" ||
    key === "unclassified"
  ) {
    return HABIT_SWATCH[key];
  }
  return undefined;
}

function seriesSwatch(
  grouping: SpendGrouping,
  row: SpendSeries,
  index: number,
): string {
  const fallback = AXIS_SWATCH[index % AXIS_SWATCH.length] ?? "var(--blue)";
  if (grouping.axis === "habit") {
    return habitSwatch(row.key) ?? fallback;
  }
  return fallback;
}

function shareLabel(share: SpendSeries["share"]): string {
  const percent = share / 100;
  return `${percent % 1 === 0 ? percent.toFixed(0) : percent.toFixed(1)}%`;
}

function plotLabel(grouping: SpendGrouping): string {
  if (grouping.series.length === 0) {
    return "No outgoing spend to plot";
  }
  return grouping.series
    .map((row) => `${row.label} ${shareLabel(row.share)}`)
    .join(", ");
}

function seriesName(row: SpendSeries): string {
  return `${row.label}, ${shareLabel(row.share)}, −${formatTokens(row.amount)}`;
}

export function SpendGroupingPanel({
  grouping,
  title,
  copy,
}: {
  grouping: SpendGrouping;
  title: string;
  copy: string;
}) {
  return (
    <section className="bank-section">
      <div className="bank-section-heading">
        <div>
          <h2>{title}</h2>
          <p>
            {copy} {formatTokens(grouping.total)} posted out.
          </p>
        </div>
      </div>
      {grouping.series.length === 0 ? (
        <p className="reports-pending">No outgoing spend on this register yet.</p>
      ) : (
        <>
          <p className="sr-only">{plotLabel(grouping)}</p>
          <div className="spend-plot">
            {grouping.series.map((row, index) => (
              <Link
                key={row.key}
                href={row.href}
                className="spend-plot-seg"
                style={{
                  flexGrow: row.share,
                  background: seriesSwatch(grouping, row, index),
                }}
                aria-label={seriesName(row)}
              />
            ))}
          </div>
          <ul className="spend-series">
            {grouping.series.map((row, index) => {
              const ink = seriesSwatch(grouping, row, index);
              return (
                <li key={row.key}>
                  <Link href={row.href} aria-label={seriesName(row)}>
                    <span className="spend-swatch" style={{ background: ink }} />
                    <span>{row.label}</span>
                    <strong>−{formatTokens(row.amount)}</strong>
                    <span className="spend-share">{shareLabel(row.share)}</span>
                    <span className="spend-row-bar" aria-hidden="true">
                      <span style={{ width: `${row.share / 100}%`, background: ink }} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
