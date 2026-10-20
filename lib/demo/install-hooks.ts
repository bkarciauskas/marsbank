import fs from "node:fs";
import path from "node:path";

type HookEntry = { command: string } & Record<string, unknown>;
type HooksConfig = { version: number; hooks: Record<string, HookEntry[]> };

/**
 * Hook kits Setup merges into `.cursor/hooks.json`. A kit owns the entries
 * whose `command` appears in its staged hooks.json, and nothing else, so kits
 * and hand-written hooks coexist.
 */
export const hookKits = {
  hooks: {
    dir: "demo/cursor-hooks",
    scripts: [
      "append-activity.mjs",
      "guard-prompt.mjs",
      "guard-secrets.mjs",
      "pii-patterns.mjs",
      "record-edit.mjs",
      "run-tests.mjs",
    ],
  },
  "agent-autopilot": {
    dir: "demo/style-autopilot",
    scripts: ["format-edit.mjs"],
  },
} as const;

export type HookKitId = keyof typeof hookKits;

// Vitest must not touch live Cursor hooks — stop-hook `npm test` would uninstall
// the presenter kit mid-walk (same pattern as hook-activity.jsonl).
const installHome = process.env.VITEST
  ? path.join(process.cwd(), ".cursor", "hooks-vitest")
  : path.join(process.cwd(), ".cursor");

/** Exposed for tests that assert the Vitest sandbox paths. */
export const hookInstallPaths = {
  hooksJson: path.join(installHome, "hooks.json"),
  hooksDir: path.join(installHome, "hooks"),
};

export function isHookKit(id: string): id is HookKitId {
  return Object.hasOwn(hookKits, id);
}

export function hookKitDir(id: HookKitId): string {
  return path.join(process.cwd(), hookKits[id].dir);
}

function kitConfig(id: HookKitId): HooksConfig {
  const file = path.join(hookKitDir(id), "hooks.json");
  if (!fs.existsSync(file)) {
    throw new Error(`Demo hook kit is missing from ${hookKits[id].dir}.`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as HooksConfig;
}

function kitCommands(id: HookKitId): Set<string> {
  return new Set(
    Object.values(kitConfig(id).hooks).flatMap((entries) =>
      entries.map((entry) => entry.command),
    ),
  );
}

function readInstalled(): HooksConfig {
  try {
    return JSON.parse(
      fs.readFileSync(hookInstallPaths.hooksJson, "utf8"),
    ) as HooksConfig;
  } catch (error) {
    if (isMissingPath(error)) return { version: 1, hooks: {} };
    throw error;
  }
}

function writeInstalled(config: HooksConfig): void {
  fs.mkdirSync(path.dirname(hookInstallPaths.hooksJson), { recursive: true });
  fs.writeFileSync(
    hookInstallPaths.hooksJson,
    `${JSON.stringify(config, null, 2)}\n`,
  );
}

function withoutKit(config: HooksConfig, id: HookKitId): HooksConfig {
  const owned = kitCommands(id);
  const hooks: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(config.hooks)) {
    const kept = entries.filter((entry) => !owned.has(entry.command));
    if (kept.length > 0) hooks[event] = kept;
  }
  return { ...config, hooks };
}

export function hookKitInstalled(id: HookKitId): boolean {
  const owned = kitCommands(id);
  return Object.values(readInstalled().hooks).some((entries) =>
    entries.some((entry) => owned.has(entry.command)),
  );
}

export function installHookKit(id: HookKitId): void {
  const kit = hookKits[id];
  const staged = kitConfig(id);
  fs.mkdirSync(hookInstallPaths.hooksDir, { recursive: true });
  for (const file of kit.scripts) {
    const source = path.join(hookKitDir(id), file);
    if (!fs.existsSync(source)) {
      throw new Error(`Demo hook kit is missing ${file}.`);
    }
    fs.copyFileSync(source, path.join(hookInstallPaths.hooksDir, file));
  }
  const config = withoutKit(readInstalled(), id);
  for (const [event, entries] of Object.entries(staged.hooks)) {
    config.hooks[event] = [...(config.hooks[event] ?? []), ...entries];
  }
  writeInstalled(config);
}

export function uninstallHookKit(id: HookKitId): void {
  // Clear hooks.json first so a Cursor reload cannot re-attach deleted scripts.
  // Staging kit omits failClosed so a mid-session Reset cannot brick Write/Shell
  // if Cursor still has the old config in memory while scripts are removed.
  if (hookKitInstalled(id)) writeInstalled(withoutKit(readInstalled(), id));
  for (const file of hookKits[id].scripts) {
    try {
      fs.unlinkSync(path.join(hookInstallPaths.hooksDir, file));
    } catch (error) {
      if (!isMissingPath(error)) throw error;
    }
  }
}

export function uninstallAllHookKits(): void {
  for (const id of Object.keys(hookKits) as HookKitId[]) uninstallHookKit(id);
}

function isMissingPath(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
