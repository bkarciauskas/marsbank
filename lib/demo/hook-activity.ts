import fs from "node:fs";
import path from "node:path";

// Vitest clears this path in teardown; keep the live demo log separate so
// `npm test` from the stop hook does not wipe presenter-visible events.
export const hookActivityPath = path.join(
  process.cwd(),
  ".cursor",
  "hooks",
  process.env.VITEST ? "demo-activity.test.jsonl" : "demo-activity.jsonl",
);

export type HookActivityEntry = {
  at: string;
  event: string;
  detail: string;
  ok?: boolean;
};

export function clearHookActivity(): void {
  try {
    fs.unlinkSync(hookActivityPath);
  } catch (error) {
    if (isMissingPath(error)) return;
  }
}

export function readHookActivity(): HookActivityEntry[] {
  try {
    const raw = fs.readFileSync(hookActivityPath, "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => parseEntry(line))
      .filter((entry): entry is HookActivityEntry => entry !== null);
  } catch (error) {
    if (isMissingPath(error)) return [];
    throw error;
  }
}

function parseEntry(line: string): HookActivityEntry | null {
  try {
    const value: unknown = JSON.parse(line);
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as { at?: unknown }).at !== "string" ||
      typeof (value as { event?: unknown }).event !== "string" ||
      typeof (value as { detail?: unknown }).detail !== "string"
    ) {
      return null;
    }
    const entry: HookActivityEntry = {
      at: (value as { at: string }).at,
      event: (value as { event: string }).event,
      detail: (value as { detail: string }).detail,
    };
    if (typeof (value as { ok?: unknown }).ok === "boolean") {
      entry.ok = (value as { ok: boolean }).ok;
    }
    return entry;
  } catch {
    return null;
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
