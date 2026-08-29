import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SurveySelect } from "./survey-select";

const options = [
  { value: "everyday", label: "Sol Account · 1038 4821" },
  { value: "reserve", label: "Long Horizon Reserve · 2047 1903" },
  { value: "offset", label: "Habitat Offset · 4410 8732" },
];

describe("SurveySelect", () => {
  it("opens a listbox and reports the chosen account", () => {
    const onChange = vi.fn();
    render(
      <SurveySelect
        id="transfer-from"
        onChange={onChange}
        options={options}
        value="everyday"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Sol Account · 1038 4821" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Habitat Offset · 4410 8732" }));

    expect(onChange).toHaveBeenCalledWith("offset");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves and confirms a row with the keyboard", () => {
    const onChange = vi.fn();
    render(
      <SurveySelect
        id="transfer-from"
        onChange={onChange}
        options={options}
        value="everyday"
      />,
    );

    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    const listbox = screen.getByRole("listbox");
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    fireEvent.keyDown(listbox, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("reserve");
  });
});
