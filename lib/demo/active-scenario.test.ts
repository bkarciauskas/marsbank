import { describe, expect, it } from "vitest";
import {
  currentDemoScenario,
  holdsReserveCredits,
  runWithDemoScenario,
} from "./active-scenario";

describe("active demo scenario", () => {
  it("stays idle outside a request context", () => {
    expect(currentDemoScenario()).toBeNull();
    expect(holdsReserveCredits()).toBe(false);
  });

  it("holds reserve credits only for the debug-mode walk", () => {
    runWithDemoScenario("hooks", () => {
      expect(currentDemoScenario()).toBe("hooks");
      expect(holdsReserveCredits()).toBe(false);
    });
    runWithDemoScenario("debug-mode", () => {
      expect(currentDemoScenario()).toBe("debug-mode");
      expect(holdsReserveCredits()).toBe(true);
    });
    expect(holdsReserveCredits()).toBe(false);
  });
});
