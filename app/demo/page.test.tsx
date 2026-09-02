import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoPage from "./page";

describe("DemoPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ active: null }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders both demo walks and reset all", () => {
    render(<DemoPage />);

    expect(
      screen.getByRole("heading", { name: "Demos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Cursor Hooks/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Cursor Debug Mode/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /PII & secrets/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset all" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Demos" })[0],
    ).toHaveAttribute("href", "/demo");
  });
});
