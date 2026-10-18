import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
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

  it("explains an empty search result", () => {
    searchParams.set("q", "phobos shipyard");
    renderAccounts();

    expect(screen.getByText(/no accounts match/i)).toBeInTheDocument();
  });
});
