import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoEmail, demoPassword } from "@/lib/fixtures";
import { LoginForm } from "./login-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  it("prefills the fictional Mars Bank credentials", () => {
    render(<LoginForm />);
    expect(screen.getByDisplayValue(demoEmail)).toBeInTheDocument();
    expect(screen.getByDisplayValue(demoPassword)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /cameron/i })).toBeChecked();
  });

  it("fills Aaron's demo ID and password from the roster", () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("radio", { name: /aaron/i }));
    expect(screen.getByDisplayValue("aaron@marsbank.mars")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Tharsis!2026")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /aaron/i })).toBeChecked();
  });

  it("opens digital banking after a valid demo login", async () => {
    render(<LoginForm />);
    fireEvent.click(screen.getByRole("button", { name: "Enter Mars Bank" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/banking"));
  });
});
