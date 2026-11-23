import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import ActivityPage from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

describe("activity search Expedition Credit", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParams.delete("q");
  });

  it("returns credit-card movements when the query matches the account name", () => {
    searchParams.set("q", "Expedition Credit");
    const { container } = render(
      <BankProvider>
        <ActivityPage />
      </BankProvider>,
    );

    const rows = container.querySelectorAll(".transaction-row");

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.textContent).toMatch(/rim tram|rover|valles lift/i);
    }
  });
});