import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function drive(feature: string): string {
  try {
    return execFileSync(
      process.execPath,
      [".cursor/skills/verify-marsbank/scripts/drive.mjs", feature],
      { cwd: process.cwd(), encoding: "utf8" },
    );
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return `${failed.stdout ?? ""}${failed.stderr ?? ""}`;
  }
}

describe("verify-marsbank drive commands", () => {
  it("accepts reports and settings before it looks for a running instance", () => {
    for (const feature of ["reports", "settings"]) {
      const output = drive(feature);
      expect(output).not.toContain(`Unknown feature "${feature}"`);
      expect(output).toContain("no instance file");
    }
  });
});
