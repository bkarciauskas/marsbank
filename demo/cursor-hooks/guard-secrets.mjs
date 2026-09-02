import { appendActivity } from "./append-activity.mjs";
import { findSecretRisks, toolPayloadText } from "./pii-patterns.mjs";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input = {};
try {
  input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
} catch {
  process.stdout.write(`${JSON.stringify({ permission: "allow" })}\n`);
  process.exit(0);
}

const payload = toolPayloadText(input.tool_input);
const targetPath = String(
  input.tool_input?.path ??
    input.tool_input?.file_path ??
    input.tool_input?.filePath ??
    "",
);
// Allow test fixtures to mention secret shapes without blocking the suite.
if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(targetPath)) {
  process.stdout.write(`${JSON.stringify({ permission: "allow" })}\n`);
  process.exit(0);
}

const risks = findSecretRisks(payload);
if (risks.length === 0) {
  process.stdout.write(`${JSON.stringify({ permission: "allow" })}\n`);
  process.exit(0);
}

const labels = risks.map((risk) => risk.label).join(", ");
const tool = String(input.tool_name ?? "tool");
appendActivity({
  event: "preToolUse",
  detail: `Blocked ${tool} · ${labels}`,
  ok: false,
});

process.stdout.write(
  `${JSON.stringify({
    permission: "deny",
    user_message: `Mars Bank policy blocked this ${tool} call (${labels}). Keep API keys and secrets out of the repo.`,
    agent_message: `Do not write or echo secrets (${labels}). Use the secrets tooling / env store instead of committing credentials.`,
  })}\n`,
);
