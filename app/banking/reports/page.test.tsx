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
    expect(
      screen.getByRole("heading", { level: 2, name: "Spend by habit" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Spend by account" }),
    ).toBeInTheDocument();
    expect(document.querySelectorAll(".spend-plot")).toHaveLength(2);
  });

  it("uses desk cards instead of the public register chrome", () => {
    const { container } = render(
      <BankProvider>
        <ReportsRegister drill={{ kind: "overview" }} />
      </BankProvider>,
    );

    expect(container.querySelector(".desk")).not.toBeNull();
    expect(container.querySelectorAll(".desk-card").length).toBeGreaterThanOrEqual(
      3,
    );
    expect(container.querySelector(".desk-glance")).not.toBeNull();
    expect(container.querySelector(".desk-primary-action")).toHaveAttribute(
      "href",
      "/banking/activity",
    );
    expect(container.querySelector(".reports-ledger-link")).toBeNull();
    expect(container.querySelector(".bank-section")).toBeNull();
  });

  it("opens a flow slice as another desk card", () => {
    render(
      <BankProvider>
        <ReportsRegister drill={{ kind: "flow", flow: "out" }} />
      </BankProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Tokens out" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "All posted movement" }),
    ).toHaveAttribute("href", "/banking/reports");
    expect(document.querySelectorAll(".desk-card").length).toBeGreaterThanOrEqual(
      4,
    );
  });
});
