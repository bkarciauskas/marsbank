import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { flowPage, spendGrouping } from "@/lib/flow-report";
import { seedSnapshot } from "@/lib/fixtures";
import { SpendGroupingPanel } from "./spend-grouping";

describe("SpendGroupingPanel", () => {
  it("plots spend by habit and drills into a habit slice", () => {
    const { report } = flowPage(seedSnapshot, { kind: "overview" });
    render(
      <SpendGroupingPanel
        grouping={spendGrouping(report, "habit")}
        title="Spend by habit"
        copy="Outgoing posted tokens, grouped by what they paid for."
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Spend by habit" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".spend-plot")).not.toBeNull();
    expect(screen.getByText(/habitat .*, food/i)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /food/i })[0],
    ).toHaveAttribute("href", "/banking/reports?view=habit&habit=food");
  });

  it("plots spend by account and opens the paying account", () => {
    const { report } = flowPage(seedSnapshot, { kind: "overview" });
    const grouping = spendGrouping(report, "account");
    const first = grouping.series[0];
    if (!first) {
      throw new Error("seed snapshot should have outgoing spend");
    }

    render(
      <SpendGroupingPanel
        grouping={grouping}
        title="Spend by account"
        copy="The same outgoing tokens, grouped by the account that paid."
      />,
    );

    expect(
      screen.getAllByRole("link", { name: new RegExp(first.label, "i") })[0],
    ).toHaveAttribute("href", first.href);
  });

  it("states when nothing has gone out", () => {
    const empty = flowPage(
      { ...seedSnapshot, transactions: [] },
      { kind: "overview" },
    );
    render(
      <SpendGroupingPanel
        grouping={spendGrouping(empty.report, "habit")}
        title="Spend by habit"
        copy="Outgoing posted tokens, grouped by what they paid for."
      />,
    );

    expect(
      screen.getByText(/no outgoing spend on this register yet/i),
    ).toBeInTheDocument();
  });
});
