import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoResidentBySlug, seedSnapshotForSlug } from "@/lib/fixtures";
import { paymentRequestId } from "@/lib/ids";
import { tokens } from "@/lib/money";
import { applyCreatePaymentRequest } from "@/lib/shared-ledger";
import { BankProvider } from "@/lib/store";
import { createLedgerFetch } from "@/test-utils/ledger-fetch";
import { TransferForm } from "./transfer-form";

describe("TransferForm", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows today's PayID allowance and advances it after a send", async () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    const meter = () =>
      screen.getByRole("meter", { name: "PayID tokens sent this sol" });
    expect(meter()).toHaveAttribute("aria-valuemin", "0");
    expect(meter()).toHaveAttribute("aria-valuemax", "250000");
    expect(meter()).toHaveAttribute("aria-valuenow", "0");
    expect(meter()).toHaveAttribute(
      "aria-valuetext",
      "0 of 250,000 tokens used. Step-up above 50,000 tokens.",
    );
    expect(
      screen.getByRole("heading", { name: "Today's PayID limit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 250,000 tokens used")).toBeInTheDocument();
    expect(screen.getByText("250,000 tokens left this sol")).toBeInTheDocument();
    expect(screen.getByText("Step-up above 50,000 tokens")).toBeInTheDocument();
    expect(document.querySelector(".sol-allowance-step")).toHaveStyle({
      left: "20%",
    });

    fireEvent.change(screen.getByPlaceholderText("@name or name@domain"), {
      target: { value: "@cursor" },
    });
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "2500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review route" }));
    fireEvent.click(screen.getByRole("button", { name: "Send tokens" }));

    expect(await screen.findByText("Tokens dispatched")).toBeInTheDocument();
    expect(meter()).toHaveAttribute("aria-valuenow", "2500");
    expect(screen.getByText("2,500 of 250,000 tokens used")).toBeInTheDocument();
    expect(
      screen.getByText("247,500 tokens left this sol"),
    ).toBeInTheDocument();
  });

  it("opens a PayID route from to, payid, amount, and note", () => {
    render(
      <BankProvider>
        <TransferForm
          prefill={{
            from: "acc-reserve",
            to: "acc-habitat-loan",
            payid: "@cursor",
            amount: "1,500",
            note: "  Greenhouse share  ",
          }}
        />
      </BankProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Cursor or PayID" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("@name or name@domain")).toHaveValue(
      "@cursor",
    );
    expect(screen.getByPlaceholderText("0")).toHaveValue("1500");
    expect(screen.getByPlaceholderText("Optional note")).toHaveValue(
      "Greenhouse share",
    );
    expect(
      screen.getByRole("button", { name: /Long Horizon Reserve/ }),
    ).toBeInTheDocument();
  });

  it("opens an own-account route from to when payid is absent", () => {
    render(
      <BankProvider>
        <TransferForm
          prefill={{
            from: "acc-everyday",
            to: "acc-habitat-loan",
            amount: "10000",
            note: "Habitat levy",
          }}
        />
      </BankProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Between my accounts" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Sol Account/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Olympus Arc Habitat/ }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("0")).toHaveValue("10000");
    expect(screen.getByPlaceholderText("Optional note")).toHaveValue(
      "Habitat levy",
    );
  });

  it("ignores an amount that is not whole tokens and keeps the note short", () => {
    const note = "Arc canteen tray for the north ridge crew tonight please extra";
    render(
      <BankProvider>
        <TransferForm
          prefill={{
            payid: "  ",
            to: "not-an-account",
            amount: "12.5",
            note,
          }}
        />
      </BankProvider>,
    );

    expect(
      screen.getByRole("button", { name: "Cursor or PayID" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByPlaceholderText("@name or name@domain")).toHaveValue("");
    expect(screen.getByPlaceholderText("0")).toHaveValue("");
    expect(screen.getByPlaceholderText("Optional note")).toHaveValue(
      note.slice(0, 60),
    );
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

  it("creates, validates, and cancels outgoing resident payment requests", async () => {
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request tokens" }));

    fireEvent.change(
      screen.getByPlaceholderText("@resident or resident@marsbank.mars"),
      { target: { value: "@cameron" } },
    );
    fireEvent.change(screen.getByPlaceholderText("0"), {
      target: { value: "1200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That identity points back to your own Mars Bank profile.",
    );

    fireEvent.change(
      screen.getByPlaceholderText("@resident or resident@marsbank.mars"),
      { target: { value: "@cursor" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Requests can only be sent to another Mars Bank resident.",
    );

    fireEvent.change(
      screen.getByPlaceholderText("@resident or resident@marsbank.mars"),
      { target: { value: "@ben" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("Short reference, e.g. Arc Canteen tray"),
      { target: { value: "Arc Canteen tray" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    expect(
      await screen.findByText("Requested 1,200 tokens from Ben."),
    ).toBeInTheDocument();
    expect(screen.getByText("1,200 tokens from Ben")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel request" }));
    await waitFor(() =>
      expect(screen.getByText("Cancelled")).toBeInTheDocument(),
    );
  });

  it("approves and declines incoming requests in the Send view while enforcing step-up and the sol cap", async () => {
    const aaronResident = demoResidentBySlug("aaron");
    const cameronResident = demoResidentBySlug("cameron");
    if (!aaronResident || !cameronResident) return;

    const first = applyCreatePaymentRequest({
      amount: tokens(200_000),
      description: "Rover charter",
      id: paymentRequestId("pr-send-1"),
      now: new Date("2026-10-20T10:00:00.000Z"),
      payer: seedSnapshotForSlug("cameron"),
      payerResident: cameronResident,
      requester: seedSnapshotForSlug("aaron"),
      requesterResident: aaronResident,
    });
    if (first.kind !== "ok") return;

    const second = applyCreatePaymentRequest({
      amount: tokens(60_000),
      description: "Extra cells",
      id: paymentRequestId("pr-send-2"),
      now: new Date("2026-10-20T10:05:00.000Z"),
      payer: first.counterparty,
      payerResident: cameronResident,
      requester: first.actor,
      requesterResident: aaronResident,
    });
    if (second.kind !== "ok") return;

    vi.stubGlobal("fetch", createLedgerFetch(second.counterparty));
    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    expect(
      await screen.findByText("Aaron requested 200,000 tokens"),
    ).toBeInTheDocument();

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
    const secondApprove = approveButtons[1];
    expect(secondApprove).toBeDefined();
    if (!secondApprove) return;
    fireEvent.click(secondApprove);

    const confirmBtn = screen.getByRole("button", { name: "Confirm payment" });
    expect(confirmBtn).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /I confirm sending 200,000 tokens to Aaron/,
      }),
    );
    fireEvent.click(confirmBtn);

    expect(
      await screen.findByText(/Paid 200,000 tokens to Aaron from Sol Account/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That send passes your 250,000 tokens PayID limit for this sol.",
    );

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(
      await screen.findByText(/Declined 60,000 tokens request from Aaron/),
    ).toBeInTheDocument();
  });
});
