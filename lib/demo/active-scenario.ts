import { AsyncLocalStorage } from "node:async_hooks";
import { type DemoScenarioId } from "./scenarios";

const storage = new AsyncLocalStorage<DemoScenarioId | null>();

export function currentDemoScenario(): DemoScenarioId | null {
  return storage.getStore() ?? null;
}

export function holdsReserveCredits(): boolean {
  return currentDemoScenario() === "debug-mode";
}

export function runWithDemoScenario<T>(
  scenario: DemoScenarioId | null | undefined,
  fn: () => T,
): T {
  return storage.run(scenario ?? null, fn);
}
