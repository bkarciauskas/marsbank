// @vitest-environment node
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyToSource,
  defaultTarget,
  healthyDebit,
  plantedDebit,
  plantState,
  readTarget,
  revertToSource,
  runPlant,
} from "./plant.mjs";

const healthyFile = `function debit() {\n${healthyDebit}\n}\n`;
const plantedFile = `function debit() {\n${plantedDebit}\n}\n`;

describe("demo plant", () => {
  it("detects healthy, planted, and unknown offset debit forms", () => {
    expect(plantState(healthyFile)).toBe("healthy");
    expect(plantState(plantedFile)).toBe("planted");
    expect(plantState("case \"offset\":\n      return account;\n")).toBe("unknown");
  });

  it("apply and revert converge and stay put on a second run", () => {
    const planted = applyToSource(healthyFile);
    expect(planted.state).toBe("planted");
    expect(planted.source).toBe(plantedFile);
    expect(applyToSource(planted.source).source).toBe(plantedFile);

    const healthy = revertToSource(planted.source);
    expect(healthy.state).toBe("healthy");
    expect(healthy.source).toBe(healthyFile);
    expect(revertToSource(healthy.source).source).toBe(healthyFile);
  });

  it("refuses a drifted debit function", () => {
    expect(() => applyToSource("not the ledger")).toThrow(/known healthy or planted form/);
    expect(() => revertToSource("not the ledger")).toThrow(/known healthy or planted form/);
  });

  it("apply then revert leaves the real ledger file unchanged", () => {
    const before = readTarget();
    expect(plantState(before)).toBe("healthy");

    const dir = mkdtempSync(join(tmpdir(), "marsbank-plant-"));
    const copy = join(dir, "ledger.ts");
    writeFileSync(copy, before);

    const applied = runPlant("apply", { target: copy });
    expect(applied.state).toBe("planted");
    expect(applied.changed).toBe(true);
    expect(plantState(readFileSync(copy, "utf8"))).toBe("planted");

    const again = runPlant("apply", { target: copy });
    expect(again.changed).toBe(false);

    const reverted = runPlant("revert", { target: copy });
    expect(reverted.state).toBe("healthy");
    expect(readFileSync(copy, "utf8")).toBe(before);
    expect(readTarget(defaultTarget)).toBe(before);
  });
});
