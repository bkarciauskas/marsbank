import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seedSnapshotForSlug } from "@/lib/fixtures";
import { applyIncomingResidentTransfer } from "@/lib/ledger";
import { tokens } from "@/lib/money";
import { BankProvider } from "@/lib/store";
import { incomingReadKey } from "@/lib/use-incoming-read";
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

  it("shows an empty incoming feed on a seeded register", async () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));

    expect(
      await screen.findByText("No tokens from other residents yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });

  it("lights the bell when a resident credit arrives on refresh, then clears it", async () => {
    let register = seedSnapshotForSlug("cameron");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ snapshot: register })),
    );
    renderShell();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();

    register = applyIncomingResidentTransfer(
      register,
      {
        amount: tokens(250),
        description: "Dust filters",
        requestId: "req-1",
        senderEmail: "aaron@marsbank.mars",
        senderName: "Aaron Vale",
      },
      new Date("2026-10-20T10:00:00.000Z"),
    );
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    const bell = await screen.findByRole("button", {
      name: "Notifications, 1 unread",
    });
    fireEvent.click(bell);
    const panel = screen.getByRole("region", { name: "Incoming transfers" });
    expect(panel).toHaveTextContent("Aaron Vale sent 250 tokens");
    expect(panel).toHaveTextContent("Dust filters");

    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(
      window.localStorage.getItem(incomingReadKey("cameron@marsbank.mars")),
    ).toBe("2026-10-20T10:00:00.000Z");
    expect(
      window.localStorage.getItem(incomingReadKey("aaron@marsbank.mars")),
    ).toBeNull();
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
