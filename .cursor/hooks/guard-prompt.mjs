import { appendActivity } from "./append-activity.mjs";
import { findPromptRisks } from "./pii-patterns.mjs";

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);

let input = {};
try {
  input = JSON.parse(Buffer.concat(chunks).toString() || "{}");
} catch {
  process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
  process.exit(0);
}

const prompt = String(
  input.prompt ?? input.text ?? input.message ?? input.content ?? "",
);
const risks = findPromptRisks(prompt);
if (risks.length === 0) {
  process.stdout.write(`${JSON.stringify({ continue: true })}\n`);
  process.exit(0);
}

const labels = risks.map((risk) => risk.label).join(", ");
appendActivity({
  event: "beforeSubmitPrompt",
  detail: `Blocked prompt · ${labels}`,
  ok: false,
});

// Always emit the block decision after logging — never let logging failures
// fail-open the PII prompt.
process.stdout.write(
  `${JSON.stringify({
    continue: false,
    user_message: `Mars Bank policy blocked this prompt (${labels}). Do not export customer PII or credentials to files.`,
  })}\n`,
);
