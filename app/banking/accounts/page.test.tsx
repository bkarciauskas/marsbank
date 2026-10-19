import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import AccountsPage from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function renderAccounts() {
  return render(
    <BankProvider>
      <AccountsPage />
    </BankProvider>,
  );
}

describe("AccountsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParams.delete("q");
  });

  it("keeps the Token register heading and reveals the position", () => {
    renderAccounts();

    expect(
      screen.getByRole("heading", { level: 1, name: "Token register" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Register position" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show register position" }));

    const position = screen.getByRole("region", { name: "Register position" });
    expect(within(position).getByText("On hand").closest("div")).toHaveTextContent(
      "4,002,644,620",
    );
    expect(within(position).getByText("Owing").closest("div")).toHaveTextContent(
      "36,400,082,640",
    );
    expect(within(position).getByText("Net position").closest("div")).toHaveTextContent(
      "−32,397,438,020",
    );
    expect(
      screen.getByRole("button", { name: "Hide register position" }),
    ).toHaveAttribute("aria-expanded", "true");
  });

  it("tallies only the accounts the search leaves visible", () => {
    searchParams.set("q", "long horizon");
    renderAccounts();

    fireEvent.click(screen.getByRole("button", { name: "Show register position" }));

    const position = screen.getByRole("region", { name: "Register position" });
    expect(within(position).getByText("On hand").closest("div")).toHaveTextContent(
      "2,001,840,000",
    );
    expect(within(position).getByText("Owing").closest("div")).toHaveTextContent("0");
    expect(within(position).getByText("Net position").closest("div")).toHaveTextContent(
      "+2,001,840,000",
    );
  });

  it("shows both register sections when no search is applied", () => {
    renderAccounts();

    expect(
      screen.getByRole("heading", { level: 2, name: "Offset accounts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Habitat debt and expedition credit",
      }),
    ).toBeInTheDocument();
  });

  it("narrows the register to accounts matching the search", () => {
    searchParams.set("q", "long horizon");
    const { container } = renderAccounts();

    const rows = container.querySelectorAll(".account-list a");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toMatch(/long horizon reserve/i);
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Habitat debt and expedition credit",
      }),
    ).not.toBeInTheDocument();
  });

  it("matches on product name as well as account name", () => {
    searchParams.set("q", "expedition credit line");
    const { container } = renderAccounts();

    const rows = container.querySelectorAll(".account-list a");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toMatch(/expedition credit/i);
  });

  it("hides every balance until shown again", () => {
    const { container } = renderAccounts();
    const register = () =>
      Array.from(container.querySelectorAll(".account-value strong, .account-list-totals strong"))
        .map((cell) => cell.textContent)
        .join(" ");

    fireEvent.click(screen.getByRole("button", { name: "Show register position" }));
    expect(register()).toMatch(/\d{1,3},\d{3}/);

    fireEvent.click(screen.getByRole("button", { name: "Hide balances" }));

    expect(register()).not.toMatch(/\d/);
    expect(register()).toContain("••••••");
    const position = screen.getByRole("region", { name: "Register position" });
    expect(position).not.toHaveTextContent("4,002,644,620");
    expect(position).not.toHaveTextContent("−32,397,438,020");
    expect(screen.getByRole("button", { name: "Show balances" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Token register" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show balances" }));
    expect(register()).toMatch(/\d{1,3},\d{3}/);
    expect(position).toHaveTextContent("4,002,644,620");
  });

  it("explains an empty search result", () => {
    searchParams.set("q", "phobos shipyard");
    renderAccounts();

    expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
  });
});
