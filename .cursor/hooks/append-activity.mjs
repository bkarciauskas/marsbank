import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve next to this script so logging still works if cwd differs.
const hooksDir = path.dirname(fileURLToPath(import.meta.url));

// Must stay in sync with lib/demo/hook-activity.ts — Vitest uses a separate
// file so stop-hook `npm test` teardown cannot erase the live demo log.
export const activityPath = path.join(
  hooksDir,
  process.env.VITEST ? "demo-activity.test.jsonl" : "demo-activity.jsonl",
);

export function appendActivity(entry) {
  try {
    const line = JSON.stringify({
      at: new Date().toISOString(),
      ...entry,
    });
    fs.mkdirSync(path.dirname(activityPath), { recursive: true });
    fs.appendFileSync(activityPath, `${line}\n`);
  } catch (error) {
    console.error("[marsbank-hooks] appendActivity failed", error);
  }
}
