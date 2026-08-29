import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Hero } from "./hero";

vi.mock("./survey-field", () => ({
  SurveyField: () => <div data-testid="survey-field" />,
}));

describe("Hero", () => {
  it("states the Mars Bank headline", () => {
    render(<Hero />);

    expect(
      screen.getByRole("heading", { level: 1, name: "The only bank on Mars" }),
    ).toBeInTheDocument();
  });
});
