import fs from "node:fs";
import path from "node:path";
import { appendActivity } from "./append-activity.mjs";

const stamp = path.join(process.cwd(), ".cursor", "hooks", ".edited-files");
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let filePath = "";
try {
  const input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  filePath = String(input.file_path ?? input.path ?? "");
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

if (filePath) {
  fs.mkdirSync(path.dirname(stamp), { recursive: true });
  fs.appendFileSync(stamp, `${filePath}\n`);
  const short = filePath.replace(`${process.cwd()}/`, "");
  appendActivity({
    event: "afterFileEdit",
    detail: `Recorded edit · ${short}`,
  });
}

process.stdout.write("{}\n");
