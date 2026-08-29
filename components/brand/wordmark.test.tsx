import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Wordmark } from "./wordmark";

describe("Wordmark", () => {
  it("renders the Mars Bank lockup", () => {
    render(<Wordmark />);
    expect(screen.getByRole("link", { name: "Mars Bank" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
