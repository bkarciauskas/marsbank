import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Account } from "@/lib/domain";
import { accountId } from "@/lib/ids";
import { tokens } from "@/lib/money";
import { AccountList } from "./account-list";

const loanId = accountId("acc-loan");

const accounts: Account[] = [
  {
    kind: "loan",
    id: loanId,
    name: "Olympus Arc Habitat",
    productName: "Mars Bank Horizon Habitat Loan",
    branch: "MARS-001",
    number: "7702 0418",
    openedOn: "2024-01-04",
    principal: tokens(42_000_000),
    remaining: tokens(36_400_000),
  },
  {
    kind: "offset",
    id: accountId("acc-everyday"),
    name: "Sol Account",
    productName: "Mars Bank Sol Offset Account",
    branch: "MARS-001",
    number: "1038 4821",
    openedOn: "2024-02-12",
    available: tokens(184_220),
    current: tokens(184_220),
    linkedLoanId: loanId,
  },
  {
    kind: "credit",
    id: accountId("acc-credit"),
    name: "Expedition Credit",
    productName: "Mars Bank Expedition Credit Line",
    branch: "MARS-001",
    number: "•••• 9072",
    openedOn: "2025-03-01",
    limit: tokens(500_000),
    owed: tokens(82_640),
  },
];

function renderList() {
  return render(<AccountList accounts={accounts} showTotals />);
}

describe("AccountList", () => {
  it("plots figures without repeating the unit already in the header", () => {
    const { container } = renderList();

    const figures = container.querySelectorAll(".account-value strong");

    expect(figures.length).toBeGreaterThan(0);
    for (const figure of figures) {
      expect(figure.textContent).not.toMatch(/tokens/i);
    }
  });

  it("never plots loan debt as spendable money", () => {
    const { container } = renderList();

    const loanRow = container.querySelector('a[href$="acc-loan"]');
    const spendable = loanRow?.querySelector(".account-value.spendable");

    expect(loanRow?.textContent).toContain("36,400,000");
    expect(spendable).toBeNull();
  });

  it("restates the column words where a product means something different", () => {
    const { container } = renderList();

    const loanRow = container.querySelector('a[href$="acc-loan"]');
    const creditRow = container.querySelector('a[href$="acc-credit"]');
    const depositRow = container.querySelector('a[href$="acc-everyday"]');

    expect(loanRow?.querySelector(".is-restated")?.textContent).toBe("Remaining");
    expect(creditRow?.querySelector(".is-restated")?.textContent).toBe(
      "Available credit",
    );
    expect(depositRow?.querySelector(".is-restated")).toBeNull();
  });

  it("totals available money without the loan and deposits without credit", () => {
    const { container } = renderList();

    const totals = container.querySelectorAll(".account-list-totals strong");

    // 184,220 deposit + 417,360 unused credit
    expect(totals[0]?.textContent).toBe("601,580");
    expect(totals[1]?.textContent).toBe("184,220");
  });
});
