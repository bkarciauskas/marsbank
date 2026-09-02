import fs from "node:fs";
import path from "node:path";

/** Source of truth for the Hooks demo kit. Setup copies these into `.cursor`. */
export const demoHooksStagingDir = path.join(
  process.cwd(),
  "demo",
  "cursor-hooks",
);

// Vitest must not touch live Cursor hooks — stop-hook `npm test` would uninstall
// the presenter kit mid-walk (same pattern as hook-activity.jsonl).
const installHome = process.env.VITEST
  ? path.join(process.cwd(), ".cursor", "hooks-vitest")
  : path.join(process.cwd(), ".cursor");

const installedHooksJson = path.join(installHome, "hooks.json");
const installedHooksDir = path.join(installHome, "hooks");

const emptyHooksConfig = `${JSON.stringify(
  { version: 1, hooks: {} },
  null,
  2,
)}\n`;

/** Hook scripts installed under `.cursor/hooks/` (tests stay in staging). */
export const demoHookScriptFiles = [
  "append-activity.mjs",
  "guard-prompt.mjs",
  "guard-secrets.mjs",
  "pii-patterns.mjs",
  "record-edit.mjs",
  "run-tests.mjs",
] as const;

/** Exposed for tests that assert the Vitest sandbox paths. */
export const demoHooksInstallPaths = {
  hooksJson: installedHooksJson,
  hooksDir: installedHooksDir,
};

export function demoHooksInstalled(): boolean {
  try {
    const raw = fs.readFileSync(installedHooksJson, "utf8");
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("hooks" in value)) {
      return false;
    }
    const hooks = (value as { hooks: unknown }).hooks;
    if (typeof hooks !== "object" || hooks === null) return false;
    return Object.keys(hooks).length > 0;
  } catch (error) {
    if (isMissingPath(error)) return false;
    return false;
  }
}

export function installDemoHooks(): void {
  if (!fs.existsSync(path.join(demoHooksStagingDir, "hooks.json"))) {
    throw new Error("Demo hook kit is missing from demo/cursor-hooks.");
  }
  fs.mkdirSync(installedHooksDir, { recursive: true });
  fs.copyFileSync(
    path.join(demoHooksStagingDir, "hooks.json"),
    installedHooksJson,
  );
  for (const file of demoHookScriptFiles) {
    const source = path.join(demoHooksStagingDir, file);
    if (!fs.existsSync(source)) {
      throw new Error(`Demo hook kit is missing ${file}.`);
    }
    fs.copyFileSync(source, path.join(installedHooksDir, file));
  }
}

export function uninstallDemoHooks(): void {
  // Clear hooks.json first so a Cursor reload cannot re-attach deleted scripts.
  // Staging kit omits failClosed so a mid-session Reset cannot brick Write/Shell
  // if Cursor still has the old config in memory while scripts are removed.
  try {
    fs.mkdirSync(path.dirname(installedHooksJson), { recursive: true });
    fs.writeFileSync(installedHooksJson, emptyHooksConfig);
  } catch (error) {
    if (!isMissingPath(error)) throw error;
  }
  for (const file of demoHookScriptFiles) {
    try {
      fs.unlinkSync(path.join(installedHooksDir, file));
    } catch (error) {
      if (!isMissingPath(error)) throw error;
    }
  }
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
