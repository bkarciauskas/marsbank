import { describe, expect, it } from "vitest";
import { bugTriagePrompts, TRIAGE_BOT_MENTION } from "./bug-triage-prompts";

describe("customer bug triage prompts", () => {
  it("splits two duplicate catches and two new bugs, each with one mention and one ambient post", () => {
    for (const kind of ["duplicate", "new"] as const) {
      const prompts = bugTriagePrompts.filter((prompt) => prompt.kind === kind);
      expect(prompts.map((prompt) => prompt.trigger).sort()).toEqual([
        "ambient",
        "mention",
      ]);
    }
    expect(new Set(bugTriagePrompts.map((prompt) => prompt.id)).size).toBe(4);
  });

  it("opens mention prompts with the bot handle and leaves it out of ambient posts", () => {
    for (const { prompt, trigger } of bugTriagePrompts) {
      if (trigger === "mention") {
        expect(prompt.startsWith(`${TRIAGE_BOT_MENTION} `)).toBe(true);
      } else {
        expect(prompt).not.toContain(TRIAGE_BOT_MENTION);
      }
    }
  });

  it("reads like a resident: no file paths, code identifiers, or stack traces", () => {
    for (const { prompt } of bugTriagePrompts) {
      expect(prompt).not.toMatch(/[\\/]|\.tsx?\b|\(\)|=>|\bat \w+ \(|\b[a-z]+[A-Z]\w*\b/);
      expect(prompt).not.toMatch(/\b(lib|src|app|test|vitest|function|ledger\.)\b/i);
    }
  });
});
