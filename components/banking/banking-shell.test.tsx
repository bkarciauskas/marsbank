import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import { BankingShell } from "./banking-shell";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/banking/accounts",
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

function renderShell() {
  return render(
    <BankProvider>
      <BankingShell>
        <div />
      </BankingShell>
    </BankProvider>,
  );
}

describe("BankingShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it("opens the demo console from the demo data chip", () => {
    renderShell();

    expect(screen.getByRole("link", { name: "Demo data" })).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  it("opens settings from the customer name", () => {
    renderShell();

    expect(
      screen.getAllByRole("link", { name: /cameron/i })[0],
    ).toHaveAttribute("href", "/banking/settings");
  });

  it("reaches reports from the sidebar while the tab bar stays at four", () => {
    renderShell();

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

  it("keeps security and help reachable outside the route rail", () => {
    renderShell();

    const support = screen.getByRole("navigation", { name: "Support" });

    expect(support.querySelector('a[href^="mailto:security@"]')).toBeInTheDocument();
    expect(support.querySelector('a[href^="mailto:support@"]')).toBeInTheDocument();
  });

  it("sends a movement search to the activity ledger", () => {
    renderShell();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "areology coffee" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith("/banking/activity?q=areology%20coffee");
  });

  it("sends an account-scoped search to the register", () => {
    renderShell();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Accounts" },
    });
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "crater" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).toHaveBeenCalledWith("/banking/accounts?q=crater");
  });

  it("ignores an empty search rather than routing to a blank result", () => {
    renderShell();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "   " },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(push).not.toHaveBeenCalled();
  });
});
