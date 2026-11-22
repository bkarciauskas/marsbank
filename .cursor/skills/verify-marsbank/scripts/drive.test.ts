// @vitest-environment node
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptsDir = ".cursor/skills/verify-marsbank/scripts";

function drive(feature: string): string {
  // Resolve .run/ beside this copy so a leftover instance.json cannot launch Chromium.
  const root = mkdtempSync(join(tmpdir(), "marsbank-drive-"));
  const scripts = join(root, "scripts");
  mkdirSync(scripts);
  cpSync(join(scriptsDir, "drive.mjs"), join(scripts, "drive.mjs"));
  cpSync(join(scriptsDir, "lib.mjs"), join(scripts, "lib.mjs"));
  try {
    return execFileSync(
      process.execPath,
      [join(scripts, "drive.mjs"), feature],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 10_000,
      },
    );
  } catch (error) {
    const failed = error as { stdout?: string; stderr?: string };
    return `${failed.stdout ?? ""}${failed.stderr ?? ""}`;
  } finally {
    rmSync(root, { recursive: true, force: true });
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
