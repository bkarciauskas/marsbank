import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
  let downloadedBlob: Blob | undefined;
  let downloadedName = "";

  beforeEach(() => {
    window.localStorage.clear();
    searchParams.delete("q");
    downloadedBlob = undefined;
    downloadedName = "";
    URL.createObjectURL = vi.fn((blob: Blob) => {
      downloadedBlob = blob;
      return "blob:csv";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function (this: HTMLAnchorElement) {
        downloadedName = this.download;
      },
    );
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

  it("downloads only the movements matching the search", async () => {
    searchParams.set("q", "Areology Coffee");
    renderActivity();

    fireEvent.click(screen.getByRole("button", { name: "Download CSV" }));

    if (!downloadedBlob) {
      throw new Error("expected a CSV blob");
    }
    const csv = await downloadedBlob.text();
    expect(csv).toContain("Areology Coffee");
    expect(csv).toContain("txn-001");
    expect(csv).toContain("txn-018");
    expect(csv).toContain("txn-022");
    expect(csv).not.toContain("Terraform Cooperative Payroll");
    expect(csv).not.toContain("txn-002");
    expect(downloadedName).toBe("mars-bank-statement-2026-08-07-to-2026-08-25.csv");
  });

  it("disables Download CSV when the filter matches nothing", () => {
    searchParams.set("q", "phobos shipyard");
    renderActivity();

    expect(screen.getByRole("button", { name: "Download CSV" })).toBeDisabled();
  });
});
