import { spawnSync } from "node:child_process";

/** Files the Cursor Hooks walk edits; Reset/Setup restore these from HEAD. */
export const demoSourceFiles = [
  "components/banking/transfer-form.tsx",
  "components/banking/transfer-form.test.tsx",
  "app/banking/transfer/page.tsx",
] as const;

export function restoreDemoSources(): void {
  const result = spawnSync("git", ["checkout", "--", ...demoSourceFiles], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || "Could not restore demo source files.",
    );
  }
}
