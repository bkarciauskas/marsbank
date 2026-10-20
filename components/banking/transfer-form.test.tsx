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

  function reviewPayId(amount: string) {
    fireEvent.change(screen.getByPlaceholderText("@name or name@domain"), {
      target: { value: "@cursor" },
    });
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: amount },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review route" }));
  }

  it("holds a large PayID send until the step-up box is checked", async () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    reviewPayId("60000");
    const send = screen.getByRole("button", { name: "Send tokens" });
    expect(send).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm sending 60,000 tokens to Cursor/,
      }),
    );
    expect(send).toBeEnabled();
    fireEvent.click(send);
    expect(await screen.findByText("Tokens dispatched")).toBeInTheDocument();
  });

  it("shows no step-up box at the threshold", () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    reviewPayId("50000");
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send tokens" })).toBeEnabled();
  });

  it("stops a PayID send above the per-sol limit before review", () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    reviewPayId("250001");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That send passes your 250,000 tokens PayID limit for this sol.",
    );
    expect(screen.getByRole("button", { name: "Review route" })).toBeInTheDocument();
  });
});
