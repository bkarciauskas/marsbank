import { afterEach, describe, expect, it } from "vitest";
import { applyTheme, isTheme, readTheme, themeStorageKey } from "./theme";

describe("theme", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(themeStorageKey);
  });

  it("accepts only dark and light", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("light")).toBe(true);
    expect(isTheme("system")).toBe(false);
  });

  it("applies the chosen theme to the document", () => {
    applyTheme("light");
    expect(readTheme()).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
  });
});
