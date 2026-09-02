import { describe, expect, it } from "vitest";
import {
  demoScenarioCatalog,
  isDemoScenario,
  scenarioFromCookie,
  showsHookActivity,
} from "./scenarios";

describe("demo scenarios", () => {
  it("keeps hooks and debug-mode as the presenter walks", () => {
    expect(demoScenarioCatalog.map((scenario) => scenario.id)).toEqual([
      "hooks",
      "debug-mode",
    ]);
    expect(demoScenarioCatalog[0].prompts.map((block) => block.id)).toEqual([
      "edit",
      "failing-rename",
      "pii-export",
      "secrets",
    ]);
    expect(
      demoScenarioCatalog.every((scenario) =>
        scenario.prompts.every((block) => block.description.length > 0),
      ),
    ).toBe(true);
  });

  it("accepts only staged cookie values", () => {
    expect(isDemoScenario("hooks")).toBe(true);
    expect(isDemoScenario("debug-mode")).toBe(true);
    expect(isDemoScenario("pii-guard")).toBe(false);
    expect(isDemoScenario("other")).toBe(false);
    expect(scenarioFromCookie("hooks")).toBe("hooks");
    expect(scenarioFromCookie("idle")).toBeNull();
    expect(scenarioFromCookie(undefined)).toBeNull();
  });

  it("shows hook activity on the hooks tab only", () => {
    expect(showsHookActivity("hooks")).toBe(true);
    expect(showsHookActivity("debug-mode")).toBe(false);
  });
});
