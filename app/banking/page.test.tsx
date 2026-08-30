import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BankProvider } from "@/lib/store";
import BankingOverview from "./page";

function renderOverview() {
  return render(
    <BankProvider>
      <BankingOverview />
    </BankProvider>,
  );
}

describe("BankingOverview", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("overflows from the movement rail to posted movement", () => {
    renderOverview();

    expect(
      screen.getByRole("link", { name: /posted movement/i }),
    ).toHaveAttribute("href", "/banking/reports");
  });

  it("keeps the available total on the ledger, not the greeting band", () => {
    const { container } = renderOverview();

    const footer = container.querySelector(
      ".account-list-totals > span:nth-child(2) strong",
    );
    const note = container.querySelector(".desk-glance-note");

    expect(screen.queryByText("Available total")).not.toBeInTheDocument();
    expect(container.querySelector(".desk-position")).toBeNull();
    expect(footer).not.toBeNull();
    expect(note?.textContent).toContain(footer?.textContent ?? "");
  });

  it("greets the customer in sentence case with the sol and client id", () => {
    renderOverview();

    expect(
      screen.getByRole("heading", { level: 1, name: "Good evening, Cameron" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Mars sol 21 · Client/)).toBeInTheDocument();
  });

  it("labels the sol summary as posted lines rather than available money", () => {
    const { container } = renderOverview();

    const note = container.querySelector(".desk-glance-note");

    expect(note?.textContent).toMatch(/posted lines only/i);
  });

  it("opens the ledger straight onto columns, with no heading band above them", () => {
    const { container } = renderOverview();

    const ledger = container.querySelector(
      '.desk-card[aria-label="Accounts"]',
    ) as HTMLElement;

    expect(ledger.querySelector(".desk-card-heading")).toBeNull();
    expect(
      within(ledger).getAllByRole("link").length,
    ).toBeGreaterThan(1);
  });

  it("stacks the support panels full width beneath the ledger", () => {
    const { container } = renderOverview();

    const columns = container.querySelector(".desk-columns");

    expect(columns?.querySelectorAll(":scope > .desk-card")).toHaveLength(2);
  });
});
