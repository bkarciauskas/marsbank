import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { seedSnapshotForSlug } from "./fixtures";
import { BankProvider, useBank } from "./store";
import { createLedgerFetch } from "@/test-utils/ledger-fetch";

function FirstAccountName() {
  const { snapshot } = useBank();
  return <span>{snapshot.accounts[0]?.name}</span>;
}

describe("BankProvider", () => {
  it("loads the hosted register", async () => {
    render(
      <BankProvider>
        <FirstAccountName />
      </BankProvider>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      "/api/register",
      { cache: "no-store" },
    ));
  });

  it("opens the signed-in resident register", async () => {
    vi.stubGlobal(
      "fetch",
      createLedgerFetch(seedSnapshotForSlug("aaron")),
    );
    render(
      <BankProvider customerSlug="aaron">
        <FirstAccountName />
      </BankProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Tharsis Rise Habitat")).toBeInTheDocument(),
    );
  });
});
