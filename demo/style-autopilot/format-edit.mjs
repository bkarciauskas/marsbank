import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let filePath = "";
try {
  const input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  filePath = String(input.file_path ?? "");
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

const bin = (name) => path.join(process.cwd(), "node_modules", ".bin", name);
const steps = [[bin("prettier"), ["--write", "--ignore-unknown", filePath]]];
if (/\.[cm]?[jt]sx?$/.test(filePath)) {
  steps.push([bin("eslint"), ["--fix", "--no-warn-ignored", filePath]]);
}

if (filePath && fs.existsSync(filePath)) {
  for (const [command, args] of steps) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    console.error(
      `[style-autopilot] ${path.basename(command)} ${args.join(" ")} exit:${result.status}${output ? `\n${output}` : ""}`,
    );
  }
}

process.stdout.write("{}\n");
