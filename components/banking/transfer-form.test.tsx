import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoResidentBySlug, seedSnapshotForSlug } from "@/lib/fixtures";
import { accountId, paymentRequestId, txnId } from "@/lib/ids";
import { tokens } from "@/lib/money";
import { applyCreatePaymentRequest } from "@/lib/shared-ledger";
import { BankProvider } from "@/lib/store";
import { createLedgerFetch } from "@/test-utils/ledger-fetch";
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

  it("saves a nicknamed contact, pins it, and picks a recent payee", async () => {
    const snapshot = structuredClone(seedSnapshotForSlug("cameron"));
    snapshot.transactions = [
      {
        id: txnId("recent-ben"),
        accountId: accountId("acc-everyday"),
        postedOn: "2026-11-11T00:00:00.000Z",
        description: "PayID · Ben",
        amount: tokens(40),
        direction: "debit",
        payee: {
          scheme: "payid",
          id: "ben@marsbank.mars",
          displayName: "Ben",
          institution: "Mars Bank",
        },
      },
      ...snapshot.transactions,
    ];
    vi.stubGlobal("fetch", createLedgerFetch(snapshot));

    render(
      <BankProvider>
        <TransferForm />
      </BankProvider>,
    );

    const recent = await screen.findByRole("button", {
      name: "Choose recent payee Ben ben@marsbank.mars",
    });
    fireEvent.click(recent);
    const payId = screen.getByPlaceholderText("@name or name@domain");
    expect(payId).toHaveValue("ben@marsbank.mars");

    fireEvent.change(payId, { target: { value: "@cursor" } });
    fireEvent.change(screen.getByPlaceholderText("Greenhouse share"), {
      target: { value: "Cursor desk" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save contact" }));

    const saved = await screen.findByRole("button", {
      name: "Choose Cursor desk @cursor",
    });
    expect(screen.getByRole("status")).toHaveTextContent("Saved Cursor desk.");
    fireEvent.change(payId, { target: { value: "" } });
    fireEvent.click(saved);
    expect(payId).toHaveValue("@cursor");

    fireEvent.click(screen.getByRole("button", { name: "Pin Cursor desk" }));
    expect(
      await screen.findByRole("button", { name: "Unpin Cursor desk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Choose Cursor desk @cursor" }),
    ).toHaveTextContent("Pinned");
    expect(
      screen.queryByRole("button", {
        name: "Choose recent payee Cursor @cursor",
      }),
    ).not.toBeInTheDocument();
  });
});
