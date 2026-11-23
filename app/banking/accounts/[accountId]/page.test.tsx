import "@testing-library/jest-dom/vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedSnapshot } from "@/lib/fixtures";
import { tokens } from "@/lib/money";
import { BankProvider } from "@/lib/store";
import { createLedgerFetch } from "@/test-utils/ledger-fetch";
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

  it("plans a lump sum on the habitat loan and links a prefilled repayment", () => {
    renderDetail("acc-habitat-loan");
    const planner = screen.getByRole("region", { name: "Offset planner" });
    const today = within(planner).getByRole("region", { name: "Today" });
    const plan = within(planner).getByRole("region", { name: "With this plan" });

    expect(within(today).getByText("4,002,644,620")).toBeInTheDocument();
    expect(within(today).getByText("208,137,520")).toBeInTheDocument();
    expect(
      within(planner).getByRole("link", { name: /make a repayment/i }),
    ).toHaveAttribute(
      "href",
      "/banking/transfer?from=acc-everyday&to=acc-habitat-loan",
    );

    fireEvent.change(within(planner).getByLabelText("Lump-sum payment"), {
      target: { value: "600,000,000" },
    });

    expect(
      within(planner).getByRole("link", { name: /repay 600,000,000 tokens/i }),
    ).toHaveAttribute(
      "href",
      "/banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=600000000",
    );
    expect(within(planner).getByRole("status")).toHaveTextContent(
      "100 sols sooner",
    );
    expect(within(plan).getByText("3,402,644,620")).toBeInTheDocument();
  });

  it("plans extra offset tokens without moving money", () => {
    renderDetail("acc-habitat-loan");
    const planner = screen.getByRole("region", { name: "Offset planner" });
    const plan = within(planner).getByRole("region", { name: "With this plan" });

    fireEvent.change(within(planner).getByLabelText("Move into offset"), {
      target: { value: "1,000,000,000" },
    });

    expect(within(plan).getByText("5,002,644,620")).toBeInTheDocument();
    expect(within(plan).getByText("260,137,520")).toBeInTheDocument();
    expect(within(planner).getByRole("status")).toHaveTextContent(
      /^[\d,]+ sols sooner$/,
    );
    expect(
      within(planner).getByRole("link", { name: /make a repayment/i }),
    ).toBeInTheDocument();
  });

  it("flags what-if amounts it cannot plan instead of clamping them", () => {
    renderDetail("acc-habitat-loan");
    const planner = screen.getByRole("region", { name: "Offset planner" });
    const plan = within(planner).getByRole("region", { name: "With this plan" });

    fireEvent.change(within(planner).getByLabelText("Lump-sum payment"), {
      target: { value: "2,000,000,000" },
    });
    fireEvent.change(within(planner).getByLabelText("Move into offset"), {
      target: { value: "12.5" },
    });

    const issues = within(planner).getAllByRole("alert");
    expect(issues.map((issue) => issue.textContent)).toEqual([
      "Enter whole tokens, such as 250,000.",
      "Sol Account has 1,000,184,220 tokens available.",
    ]);
    expect(within(plan).getByText("4,002,644,620")).toBeInTheDocument();
    expect(within(planner).getByRole("status")).toBeEmptyDOMElement();
    expect(
      within(planner).getByRole("link", { name: /make a repayment/i }),
    ).toBeInTheDocument();
  });

  it("meters Expedition Credit and routes one-click settlement to it", () => {
    renderDetail("acc-credit");
    const utilization = screen.getByRole("region", {
      name: "Credit utilization",
    });

    expect(
      within(utilization).getByRole("meter", { name: "Credit utilization" }),
    ).toHaveAttribute("aria-valuenow", "82640");
    expect(
      within(utilization).getByText(
        "0.17% of the 50,000,000 tokens limit drawn.",
      ),
    ).toBeInTheDocument();
    expect(
      within(utilization).getByRole("link", { name: "Clear balance" }),
    ).toHaveAttribute("href", "/banking/transfer?to=acc-credit&amount=82640");
    expect(
      within(utilization).getByRole("link", { name: "Pay custom amount" }),
    ).toHaveAttribute("href", "/banking/transfer?to=acc-credit");

    const spend = screen
      .getByRole("heading", { name: "Sol 21 card spend" })
      .closest("section");
    expect(spend).toHaveTextContent("8,960 MT posted out.");
    expect(spend).toHaveTextContent("Transit");
  });

  it("offers no settlement once Expedition Credit owes nothing", async () => {
    vi.stubGlobal(
      "fetch",
      createLedgerFetch({
        ...seedSnapshot,
        accounts: seedSnapshot.accounts.map((account) =>
          account.kind === "credit" ? { ...account, owed: tokens(0) } : account,
        ),
      }),
    );
    renderDetail("acc-credit");

    expect(await screen.findByText("Nothing owing")).toBeInTheDocument();
    expect(
      screen.getByText("0% of the 50,000,000 tokens limit drawn."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Clear balance" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Pay custom amount" }),
    ).not.toBeInTheDocument();
  });

  it("keeps credit panels to Expedition Credit", () => {
    renderDetail("acc-everyday");
    expect(
      screen.queryByRole("region", { name: "Credit utilization" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/card spend/)).not.toBeInTheDocument();
  });

  it("copies account coordinates from every account page", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    for (const [accountId, coordinates] of [
      ["acc-everyday", "MARS-001 · 1038 4821"],
      ["acc-credit", "MARS-001 · •••• 9072"],
      ["acc-habitat-loan", "MARS-001 · 7702 0418"],
    ] as const) {
      const view = renderDetail(accountId);
      fireEvent.click(screen.getByRole("button", { name: "Copy coordinates" }));
      await waitFor(() => expect(writeText).toHaveBeenCalledWith(coordinates));
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
      view.unmount();
    }
  });

  it("keeps the planner to habitat loans", () => {
    renderDetail("acc-reserve");
    expect(
      screen.queryByRole("region", { name: "Offset planner" }),
    ).not.toBeInTheDocument();
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
