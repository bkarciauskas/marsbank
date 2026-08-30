import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) => <img alt={alt} src={src} />,
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the hero and token story on the public width column", () => {
    const { container } = render(<HomePage />);

    expect(screen.getByRole("region", { name: "Mars Bank" })).toHaveClass(
      "public-width",
    );
    expect(container.querySelector("#saving")).toHaveClass("public-width");
  });

  it("keeps the security plate on the public width column", () => {
    const { container } = render(<HomePage />);

    expect(container.querySelector("#support")).toHaveClass("public-width");
    expect(container.querySelector(".security-inner")).not.toHaveClass(
      "public-width",
    );
  });
});
