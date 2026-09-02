import { describe, expect, it } from "vitest";
import {
  demoScenarioCatalog,
  isDemoScenario,
  scenarioFromCookie,
} from "./scenarios";

describe("demo scenarios", () => {
  it("keeps hooks and debug-mode as the first two walks", () => {
    expect(demoScenarioCatalog.map((scenario) => scenario.id)).toEqual([
      "hooks",
      "debug-mode",
    ]);
  });

  it("accepts only staged cookie values", () => {
    expect(isDemoScenario("hooks")).toBe(true);
    expect(isDemoScenario("debug-mode")).toBe(true);
    expect(isDemoScenario("other")).toBe(false);
    expect(scenarioFromCookie("hooks")).toBe("hooks");
    expect(scenarioFromCookie("idle")).toBeNull();
    expect(scenarioFromCookie(undefined)).toBeNull();
  });
});
