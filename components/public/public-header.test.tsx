import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PublicHeader } from "./public-header";

describe("PublicHeader", () => {
  it("does not expose appearance controls in the header", () => {
    render(<PublicHeader />);

    expect(screen.queryByRole("button", { name: "Dark" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Light" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Color theme" })).not.toBeInTheDocument();
  });
});
