import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicHeader } from "./public-header";

describe("PublicHeader", () => {
  it("reaches the demo console from the utility bar", () => {
    render(<PublicHeader />);

    expect(screen.getAllByRole("link", { name: "Demos" })[0]).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  it("does not expose appearance controls in the header", () => {
    render(<PublicHeader />);

    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Light" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Color theme" })).not.toBeInTheDocument();
  });
});
