// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  demoHookScriptFiles,
  demoHooksInstallPaths,
  demoHooksInstalled,
  demoHooksStagingDir,
  installDemoHooks,
  uninstallDemoHooks,
} from "./install-hooks";

afterEach(() => {
  uninstallDemoHooks();
});

describe("installDemoHooks", () => {
  it("copies the staging kit into a Vitest sandbox, not live .cursor hooks", () => {
    expect(fs.existsSync(path.join(demoHooksStagingDir, "hooks.json"))).toBe(
      true,
    );
    expect(demoHooksInstallPaths.hooksJson).toContain("hooks-vitest");
    expect(demoHooksInstallPaths.hooksDir).toContain("hooks-vitest");

    uninstallDemoHooks();
    expect(demoHooksInstalled()).toBe(false);

    installDemoHooks();
    expect(demoHooksInstalled()).toBe(true);
    expect(fs.readFileSync(demoHooksInstallPaths.hooksJson, "utf8")).toBe(
      fs.readFileSync(path.join(demoHooksStagingDir, "hooks.json"), "utf8"),
    );
    for (const file of demoHookScriptFiles) {
      expect(
        fs.readFileSync(
          path.join(demoHooksInstallPaths.hooksDir, file),
          "utf8",
        ),
      ).toBe(fs.readFileSync(path.join(demoHooksStagingDir, file), "utf8"));
    }
    // Live presenter paths must stay untouched during Vitest.
    expect(demoHooksInstallPaths.hooksJson).not.toBe(
      path.join(process.cwd(), ".cursor", "hooks.json"),
    );
    expect(demoHooksInstallPaths.hooksDir).not.toBe(
      path.join(process.cwd(), ".cursor", "hooks"),
    );

    uninstallDemoHooks();
    expect(demoHooksInstalled()).toBe(false);
    expect(
      JSON.parse(fs.readFileSync(demoHooksInstallPaths.hooksJson, "utf8")),
    ).toEqual({
      version: 1,
      hooks: {},
    });
    for (const file of demoHookScriptFiles) {
      expect(
        fs.existsSync(path.join(demoHooksInstallPaths.hooksDir, file)),
      ).toBe(false);
    }
  });
});
