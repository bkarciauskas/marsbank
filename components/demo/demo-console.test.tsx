import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoConsole } from "./demo-console";

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

function mockDemoFetch(active: "hooks" | "debug-mode" | null = null) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/api/demo/hook-activity")) {
      return jsonResponse({ entries: [] });
    }
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body ?? "{}")) as {
        action?: string;
        scenario?: string;
      };
      if (body.action === "setup") {
        return jsonResponse({ active: body.scenario ?? null });
      }
      if (body.action === "reset-all") {
        return jsonResponse({ active: null });
      }
      if (body.action === "reset") {
        return jsonResponse({ active: null });
      }
    }
    return jsonResponse({ active });
  });
}

describe("DemoConsole", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockDemoFetch(null));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps hooks activity and PII prompts on the hooks tab only", async () => {
    render(<DemoConsole />);

    expect(await screen.findByText("Hooks activity")).toBeInTheDocument();
    expect(
      screen.getByText(
        "beforeSubmitPrompt blocks the ask before the agent starts.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Cursor Debug Mode/ }));
    expect(screen.queryByText("Hooks activity")).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "beforeSubmitPrompt blocks the ask before the agent starts.",
      ),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Cursor Hooks/ }));
    expect(screen.getByText("Hooks activity")).toBeInTheDocument();
  });

  it("stages the hooks walk from setup", async () => {
    const fetchMock = vi.mocked(fetch);
    render(<DemoConsole />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Setup" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/demo",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "setup", scenario: "hooks" }),
        }),
      ),
    );
    expect((await screen.findAllByText("Staged")).length).toBeGreaterThan(0);
  });

  it("resets every walk from the console header", async () => {
    vi.stubGlobal("fetch", mockDemoFetch("debug-mode"));
    render(<DemoConsole />);

    expect((await screen.findAllByText("Staged")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Reset all" }));

    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        "/api/demo",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ action: "reset-all" }),
        }),
      ),
    );
    expect(screen.queryAllByText("Staged")).toHaveLength(0);
  });
});
