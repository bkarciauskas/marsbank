import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BankProvider } from "@/lib/store";
import BankingOverview from "./page";

describe("BankingOverview", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("overflows from the movement rail to posted movement", () => {
    render(
      <BankProvider>
        <BankingOverview />
      </BankProvider>,
    );

    expect(
      screen.getByRole("link", { name: /posted movement/i }),
    ).toHaveAttribute("href", "/banking/reports");
  });
});
