import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SurveyField } from "./survey-field";

vi.mock("next/image", () => ({
  default: ({
    alt,
    className,
    src,
  }: {
    alt: string;
    className?: string;
    src: string;
  }) => <img alt={alt} className={className} src={src} />,
}));

describe("SurveyField", () => {
  const animate = Element.prototype.animate;

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
    Element.prototype.animate = animate;
    vi.unstubAllGlobals();
  });

  it("keeps the survey sheet without a lock", () => {
    render(<SurveyField />);

    expect(document.querySelector(".survey-plate")).toHaveAttribute(
      "src",
      "/assets/images/survey-sheet.jpg",
    );
    expect(document.querySelector(".survey-lock")).not.toBeInTheDocument();
    expect(document.querySelector(".survey-orbit")).not.toBeInTheDocument();
    expect(document.querySelector(".survey-index")).toBeInTheDocument();
    expect(document.querySelector(".survey-rule")).toBeInTheDocument();
  });

  it("does not survey when motion is reduced", () => {
    render(<SurveyField />);

    expect(document.querySelector(".survey-stage")).not.toHaveClass(
      "is-surveying",
    );
  });

  it("surveys the sheet when it is on screen", () => {
    let observe: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined;
    Element.prototype.animate = vi.fn(() => ({
      play: vi.fn(),
      pause: vi.fn(),
      cancel: vi.fn(),
    })) as unknown as typeof Element.prototype.animate;
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
        constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
          observe = callback;
        }
      },
    );

    render(<SurveyField />);
    observe?.([{ isIntersecting: true }]);

    expect(document.querySelector(".survey-stage")).toHaveClass("is-surveying");
  });
});
