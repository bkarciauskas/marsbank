import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TokenStorySlides } from "./token-story-slides";

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
  }) => <img alt={alt} src={src} />,
}));

describe("TokenStorySlides", () => {
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

  it("shows the first settlement view", () => {
    render(<TokenStorySlides />);

    expect(
      screen.getByAltText(
        "Residents crossing the pressurized Jezero promenade beneath a rust-red sky.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
