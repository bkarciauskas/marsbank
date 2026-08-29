import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import { BankingShell } from "./banking-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/banking/accounts",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("BankingShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("opens settings from the customer name", () => {
    render(
      <BankProvider>
        <BankingShell>
          <div />
        </BankingShell>
      </BankProvider>,
    );

    expect(
      screen.getAllByRole("link", { name: /cameron/i })[0],
    ).toHaveAttribute("href", "/banking/settings");
  });

  it("reaches reports from the sidebar while the tab bar stays at four", () => {
    render(
      <BankProvider>
        <BankingShell>
          <div />
        </BankingShell>
      </BankProvider>,
    );

    const sidebar = screen.getByRole("navigation", { name: "Banking" });
    const tabBar = screen.getByRole("navigation", { name: "Mobile banking" });

    expect(sidebar.querySelectorAll("a")).toHaveLength(5);
    expect(
      sidebar.querySelector('a[href="/banking/reports"]'),
    ).toBeInTheDocument();
    expect(tabBar.querySelectorAll("a")).toHaveLength(4);
    expect(
      tabBar.querySelector('a[href="/banking/reports"]'),
    ).not.toBeInTheDocument();
  });
});
