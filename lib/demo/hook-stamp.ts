import fs from "node:fs";
import path from "node:path";

export const hookStampPath = path.join(
  process.cwd(),
  ".cursor",
  "hooks",
  ".edited-files",
);

export function clearHookStamp(): void {
  try {
    fs.unlinkSync(hookStampPath);
  } catch (error) {
    if (isMissingPath(error)) return;
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
