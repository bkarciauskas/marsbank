import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoConsole } from "./demo-console";

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

describe("DemoConsole", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ active: null })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stages the hooks walk from setup", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<DemoConsole />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockResolvedValueOnce(jsonResponse({ active: "hooks" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Setup" })[0]);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/demo",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "setup", scenario: "hooks" }),
        }),
      ),
    );
    expect(await screen.findByText("Staged")).toBeInTheDocument();
  });

  it("resets every walk from the console header", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ active: "debug-mode" }));
    render(<DemoConsole />);

    expect(await screen.findByText("Staged")).toBeInTheDocument();
    fetchMock.mockResolvedValueOnce(jsonResponse({ active: null }));
    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/demo",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "reset-all" }),
        }),
      ),
    );
    expect(screen.queryByText("Staged")).not.toBeInTheDocument();
  });
});
