import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedSnapshot } from "@/lib/fixtures";
import { BankProvider } from "@/lib/store";
import ActivityPage from "./page";

const searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

function countExpeditionCreditMovements(needle: string): number {
  const lowered = needle.toLowerCase();
  return seedSnapshot.transactions.filter((transaction) => {
    const account = seedSnapshot.accounts.find(
      (entry) => entry.id === transaction.accountId,
    );
    const accountName = account?.name.toLowerCase() ?? "";
    const productName = account?.productName.toLowerCase() ?? "";
    return (
      transaction.description.toLowerCase().includes(lowered) ||
      accountName.includes(lowered) ||
      productName.includes(lowered)
    );
  }).length;
}

describe("activity search for Expedition Credit (MARS-25)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    searchParams.set("q", "Expedition Credit");
  });

  it("returns card movements when the query matches the account name", () => {
    const expectedMatches = countExpeditionCreditMovements("Expedition Credit");
    expect(expectedMatches).toBeGreaterThan(0);

    const { container } = render(
      <BankProvider>
        <ActivityPage />
      </BankProvider>,
    );

    expect(container.querySelectorAll(".transaction-row").length).toBe(
      expectedMatches,
    );
  });
});