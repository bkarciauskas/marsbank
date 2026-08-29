import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const stamp = path.join(process.cwd(), ".cursor", "hooks", ".edited-files");
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input = {};
try {
  input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

if (input.status && input.status !== "completed") {
  process.stdout.write("{}\n");
  process.exit(0);
}

if (process.env.MARSBANK_SKIP_TEST_HOOK === "1") {
  process.stdout.write("{}\n");
  process.exit(0);
}

let files = [];
try {
  files = fs.readFileSync(stamp, "utf8").split("\n").filter(Boolean);
} catch {
  process.stdout.write("{}\n");
  process.exit(0);
}

const relevant = files.some((file) =>
  /(?:^|\/)(?:app|components|lib)\/.+\.(?:ts|tsx)$/.test(file) ||
  /(?:^|\/)vitest\.config\.ts$/.test(file),
);

if (!relevant) {
  process.stdout.write("{}\n");
  process.exit(0);
}

const result = spawnSync("npm", ["test"], {
  encoding: "utf8",
  timeout: 80_000,
});

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
const passed = result.status === 0;

if (passed) {
  try {
    fs.unlinkSync(stamp);
  } catch {
  }
  process.stdout.write("{}\n");
  process.exit(0);
}

const tail = output.split("\n").slice(-40).join("\n");
const followup =
  (input.loop_count ?? 0) === 0
    ? {
        followup_message: `npm test failed after your changes. Fix the failures before finishing.\n\n${tail}`,
      }
    : {};

process.stdout.write(`${JSON.stringify(followup)}\n`);
