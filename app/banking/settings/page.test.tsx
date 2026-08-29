import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { accountId } from "@/lib/ids";
import { tokens } from "@/lib/money";
import { BankProvider, useBank } from "@/lib/store";
import SettingsPage from "./page";

function EverydayAvailable() {
  const { snapshot } = useBank();
  const everyday = snapshot.accounts.find(
    (account) => account.id === accountId("acc-everyday"),
  );
  return (
    <span>
      {everyday && "available" in everyday ? everyday.available : "missing"}
    </span>
  );
}

function DrainEveryday() {
  const { snapshot, transfer } = useBank();
  return (
    <button
      onClick={() =>
        void transfer({
          from: accountId("acc-everyday"),
          to: snapshot.accounts.find((account) => account.kind === "loan")!.id,
          amount: tokens(10_000),
          description: "Test repayment",
        })
      }
      type="button"
    >
      Drain
    </button>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("restores all shared seeded registers after confirmation", async () => {
    render(
      <BankProvider>
        <DrainEveryday />
        <EverydayAvailable />
        <SettingsPage />
      </BankProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Drain" }));
    expect(await screen.findByText("174220")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restore shared demo" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore all registers" }));
    expect(await screen.findByText("184220")).toBeInTheDocument();
    expect(screen.getByText("All six registers restored.")).toBeInTheDocument();
  });

  it("shows a member ID on the profile", () => {
    render(
      <BankProvider>
        <SettingsPage />
      </BankProvider>,
    );

    expect(screen.getByText("MB-104821")).toBeInTheDocument();
  });

  it("exposes dark and light appearance controls", () => {
    render(
      <BankProvider>
        <SettingsPage />
      </BankProvider>,
    );

    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });
});
