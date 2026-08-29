import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import ActivityPage from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function renderActivity() {
  return render(
    <BankProvider>
      <ActivityPage />
    </BankProvider>,
  );
}

describe("ActivityPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParams.delete("q");
  });

  it("lists the whole register when no search is applied", () => {
    const { container } = renderActivity();

    expect(
      screen.getByRole("heading", { level: 2, name: "Posted by sol" }),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll(".transaction-row").length,
    ).toBeGreaterThan(1);
  });

  it("narrows the register to movements matching the search", () => {
    searchParams.set("q", "Areology Coffee");
    const { container } = renderActivity();

    const rows = container.querySelectorAll(".transaction-row");

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toMatch(/areology coffee/i);
    }
    expect(
      screen.getByRole("link", { name: /clear search/i }),
    ).toHaveAttribute("href", "/banking/activity");
  });

  it("reports an empty result rather than a silently empty ledger", () => {
    searchParams.set("q", "phobos shipyard");
    renderActivity();

    expect(screen.getByText(/no movement on this account/i)).toBeInTheDocument();
    expect(screen.getByText(/0 matching movements/i)).toBeInTheDocument();
  });
});
