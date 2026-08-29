import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BankProvider } from "@/lib/store";
import { TransferForm } from "./transfer-form";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

describe("TransferForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reviews and posts an own-account transfer", async () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Between my accounts" }));
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "10000" },
    });
    fireEvent.change(screen.getByPlaceholderText("Optional note"), {
      target: { value: "Additional repayment" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review route" }));

    expect(screen.getByText("10,000 tokens")).toBeInTheDocument();
    expect(screen.getByText("Olympus Arc Habitat")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send tokens" }));
    expect(await screen.findByText("Tokens dispatched")).toBeInTheDocument();
  });

  it("reviews and posts a PayID transfer to a Cursor account", async () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    fireEvent.change(screen.getByPlaceholderText("@name or name@domain"), {
      target: { value: "@cursor" },
    });
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "2500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review route" }));

    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(screen.getByText("2,500 tokens")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send tokens" }));
    expect(
      await screen.findByText(
        /2,500 tokens moved from Sol Account to Cursor \(@cursor\)/,
      ),
    ).toBeInTheDocument();
  });
});
