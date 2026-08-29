import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { themeStorageKey } from "@/lib/theme";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(themeStorageKey);
  });

  it("switches the document to light mode", async () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });
});
