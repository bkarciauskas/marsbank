import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import AccountDetailPage from "./page";

const params = { accountId: "acc-reserve" };

vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

function renderDetail(accountId: string) {
  params.accountId = accountId;
  return render(
    <BankProvider>
      <AccountDetailPage />
    </BankProvider>,
  );
}

describe("AccountDetailPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    params.accountId = "acc-reserve";
  });

  it("uses desk chrome instead of the public register hero", () => {
    const { container } = renderDetail("acc-reserve");

    expect(
      screen.getByRole("heading", { level: 1, name: "Long Horizon Reserve" }),
    ).toBeInTheDocument();
    expect(container.querySelector(".desk")).not.toBeNull();
    expect(container.querySelector(".desk-intro")).not.toBeNull();
    expect(container.querySelector(".desk-position")).not.toBeNull();
    expect(container.querySelector(".desk-primary-action")).toHaveAttribute(
      "href",
      "/banking/transfer?from=acc-reserve",
    );
    expect(
      screen.getByRole("link", { name: /open habitat loan/i }),
    ).toHaveClass("desk-quiet-action");
    expect(container.querySelector(".account-detail-hero")).toBeNull();
    expect(container.querySelector(".back-link")).toBeNull();
    expect(container.querySelector(".detail-actions")).toBeNull();
    expect(container.querySelector(".offset-callout")).toBeNull();
    expect(container.querySelector(".bank-section")).toBeNull();
  });

  it("marks only spendable hero figures as signal money", () => {
    const reserve = renderDetail("acc-reserve");
    expect(reserve.container.querySelector(".desk-position")).toHaveClass(
      "spendable",
    );
    reserve.unmount();

    const loan = renderDetail("acc-habitat-loan");
    expect(
      screen.getByRole("heading", { level: 1, name: /habitat/i }),
    ).toBeInTheDocument();
    expect(loan.container.querySelector(".desk-position")).not.toHaveClass(
      "spendable",
    );
    expect(loan.container.querySelector(".desk-primary-action")).toBeNull();
    loan.unmount();

    const credit = renderDetail("acc-credit");
    expect(
      screen.getByRole("heading", { level: 1, name: "Expedition Credit" }),
    ).toBeInTheDocument();
    expect(credit.container.querySelector(".desk-position")).not.toHaveClass(
      "spendable",
    );
  });

  it("explains a missing account on the desk", () => {
    renderDetail("acc-missing");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This account is off the register",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /return to your token register/i }),
    ).toHaveAttribute("href", "/banking/accounts");
  });
});
