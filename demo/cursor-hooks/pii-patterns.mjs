/**
 * Shared detectors for the Mars Bank PII / secrets demo hooks.
 * Keep patterns deterministic so the presenter walk is reliable.
 */

const promptRisks = [
  {
    id: "bulk-customer-export",
    label: "bulk customer export",
    pattern:
      /\b(export|dump|download|extract)\b[\s\S]{0,80}\b(customer|resident|user)s?\b[\s\S]{0,80}\b(csv|spreadsheet|excel|file)\b/i,
  },
  {
    id: "email-password-harvest",
    label: "email and password harvest",
    pattern:
      /\b(email|e-mail)s?\b[\s\S]{0,60}\bpasswords?\b|\bpasswords?\b[\s\S]{0,60}\b(email|e-mail)s?\b/i,
  },
  {
    id: "pii-roster-dump",
    label: "PII roster dump",
    pattern:
      /\b(all|every|entire)\b[\s\S]{0,40}\b(customer|resident|user)s?\b[\s\S]{0,60}\b(pii|personal data|credentials|passwords?)\b/i,
  },
];

const secretRisks = [
  {
    id: "stripe-live-key",
    label: "Stripe live secret key",
    pattern: /\bsk_live_[A-Za-z0-9]{16,}\b/,
  },
  {
    id: "stripe-test-key",
    label: "Stripe test secret key",
    pattern: /\bsk_test_[A-Za-z0-9]{16,}\b/,
  },
  {
    id: "openai-key",
    label: "OpenAI API key",
    pattern: /\bsk-[A-Za-z0-9]{20,}\b/,
  },
  {
    id: "aws-access-key",
    label: "AWS access key id",
    pattern: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    id: "generic-api-key-assignment",
    label: "API key assignment",
    // Allow env prefixes (STRIPE_SECRET_KEY) — bare word-boundary misses those.
    pattern:
      /\b(?:[A-Za-z0-9]+_)*(?:api[_-]?key|secret[_-]?key|access[_-]?token)\b\s*[=:]\s*['"`]?[A-Za-z0-9_\-]{16,}/i,
  },
  {
    id: "bearer-token",
    label: "Bearer token",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/,
  },
];

export function findPromptRisks(prompt) {
  const text = String(prompt ?? "");
  return promptRisks
    .filter((risk) => risk.pattern.test(text))
    .map((risk) => ({ id: risk.id, label: risk.label }));
}

export function findSecretRisks(text) {
  const value = String(text ?? "");
  return secretRisks
    .filter((risk) => risk.pattern.test(value))
    .map((risk) => ({ id: risk.id, label: risk.label }));
}

export function toolPayloadText(toolInput) {
  if (toolInput == null) return "";
  if (typeof toolInput === "string") return toolInput;
  try {
    return JSON.stringify(toolInput);
  } catch {
    return String(toolInput);
  }
}
