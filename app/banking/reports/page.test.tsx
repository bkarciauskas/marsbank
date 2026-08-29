import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BankProvider } from "@/lib/store";
import { ReportsRegister } from "./reports-register";

describe("ReportsRegister", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("heads the register as posted movement and overflows to the ledger", () => {
    render(
      <BankProvider>
        <ReportsRegister drill={{ kind: "overview" }} />
      </BankProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Flow totals" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open full ledger/i }),
    ).toHaveAttribute("href", "/banking/activity");
    expect(
      screen.getByText(
        /posted movement, not a reconstruction of available tokens/i,
      ),
    ).toBeInTheDocument();
  });
});
