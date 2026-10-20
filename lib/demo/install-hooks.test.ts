// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  hookInstallPaths,
  hookKitDir,
  hookKitInstalled,
  hookKits,
  installHookKit,
  uninstallAllHookKits,
  uninstallHookKit,
} from "./install-hooks";

const handWritten = `${JSON.stringify(
  {
    version: 1,
    hooks: {
      afterFileEdit: [{ command: "node scripts/my-own-hook.mjs" }],
    },
  },
  null,
  2,
)}\n`;

function installedJson(): string {
  return fs.readFileSync(hookInstallPaths.hooksJson, "utf8");
}

function installedCommands(event: string): string[] {
  const config = JSON.parse(installedJson()) as {
    hooks: Record<string, { command: string }[]>;
  };
  return (config.hooks[event] ?? []).map((entry) => entry.command);
}

function script(file: string): string {
  return path.join(hookInstallPaths.hooksDir, file);
}

afterEach(() => {
  uninstallAllHookKits();
  fs.rmSync(hookInstallPaths.hooksJson, { force: true });
});

describe("hook kits", () => {
  it("installs into a Vitest sandbox, not live .cursor hooks", () => {
    expect(hookInstallPaths.hooksJson).toContain("hooks-vitest");
    expect(hookInstallPaths.hooksDir).toContain("hooks-vitest");
  });

  it("installs the Cursor Hooks kit as staged and resets to an empty config", () => {
    installHookKit("hooks");
    expect(installedJson()).toBe(
      fs.readFileSync(path.join(hookKitDir("hooks"), "hooks.json"), "utf8"),
    );
    for (const file of hookKits.hooks.scripts) {
      expect(fs.readFileSync(script(file), "utf8")).toBe(
        fs.readFileSync(path.join(hookKitDir("hooks"), file), "utf8"),
      );
    }

    uninstallHookKit("hooks");
    expect(hookKitInstalled("hooks")).toBe(false);
    expect(JSON.parse(installedJson())).toEqual({ version: 1, hooks: {} });
    for (const file of hookKits.hooks.scripts) {
      expect(fs.existsSync(script(file))).toBe(false);
    }
  });

  it("adds the style hook on Setup and Reset restores hooks.json byte for byte", () => {
    fs.mkdirSync(path.dirname(hookInstallPaths.hooksJson), { recursive: true });
    fs.writeFileSync(hookInstallPaths.hooksJson, handWritten);
    installHookKit("hooks");
    const before = installedJson();

    installHookKit("agent-autopilot");
    installHookKit("agent-autopilot");
    expect(installedCommands("afterFileEdit")).toEqual([
      "node scripts/my-own-hook.mjs",
      "node .cursor/hooks/record-edit.mjs",
      "node .cursor/hooks/format-edit.mjs",
    ]);
    expect(fs.existsSync(script("format-edit.mjs"))).toBe(true);

    uninstallHookKit("agent-autopilot");
    uninstallHookKit("agent-autopilot");
    expect(installedJson()).toBe(before);
    expect(fs.existsSync(script("format-edit.mjs"))).toBe(false);
    for (const file of hookKits.hooks.scripts) {
      expect(fs.existsSync(script(file))).toBe(true);
    }
  });

  it("leaves the style hook in place when the Cursor Hooks kit installs and resets", () => {
    fs.mkdirSync(path.dirname(hookInstallPaths.hooksJson), { recursive: true });
    fs.writeFileSync(hookInstallPaths.hooksJson, handWritten);
    installHookKit("agent-autopilot");
    const before = installedJson();

    installHookKit("hooks");
    installHookKit("hooks");
    expect(hookKitInstalled("agent-autopilot")).toBe(true);
    uninstallHookKit("hooks");
    uninstallHookKit("hooks");

    expect(installedJson()).toBe(before);
    expect(fs.existsSync(script("format-edit.mjs"))).toBe(true);
    for (const file of hookKits.hooks.scripts) {
      expect(fs.existsSync(script(file))).toBe(false);
    }
  });
});
