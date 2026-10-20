import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  agentAccountsFile,
  agentGuardrail,
  agentLintFile,
  agentRouteFile,
  goldenRouteFile,
  plantAgentLint,
  plantAgentRoute,
  plantAgentVerify,
  revertAgentGuardrails,
  withAgentLock,
} from "./agent-guardrails";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("agent-guardrails plants", () => {
  afterEach(() => {
    revertAgentGuardrails();
  });

  it("writes a UI ledger import that lint rejects, then deletes it", async () => {
    await withAgentLock(async () => {
      plantAgentLint();
      const output = await agentGuardrail("agent-lint");
      expect(output).toContain("useBank()");
      expect(output).toContain("@/lib/store");
      expect(fs.existsSync(path.join(process.cwd(), agentLintFile))).toBe(true);
      revertAgentGuardrails();
      expect(fs.existsSync(path.join(process.cwd(), agentLintFile))).toBe(false);
    });
  });

  it("renames the accounts heading and restores Token register", async () => {
    await withAgentLock(async () => {
      const original = read(agentAccountsFile);
      plantAgentVerify();
      expect(read(agentAccountsFile)).toContain("<h1>Token ledger</h1>");
      expect(read(agentAccountsFile)).not.toContain("<h1>Token register</h1>");
      const output = await agentGuardrail("agent-verify");
      expect(output).toContain("Token register");
      revertAgentGuardrails();
      expect(read(agentAccountsFile)).toBe(original);
    });
  });

  it("points a stub payees route at the transfers route and the finish commands", async () => {
    await withAgentLock(async () => {
      plantAgentRoute();
      const output = await agentGuardrail("agent-route");
      expect(output).toContain(goldenRouteFile);
      expect(output).toContain("getLedgerRepository()");
      expect(output).toContain("npm run lint");
      expect(output).toContain("npx tsc --noEmit");
      expect(fs.existsSync(path.join(process.cwd(), agentRouteFile))).toBe(true);
      revertAgentGuardrails();
      expect(fs.existsSync(path.join(process.cwd(), agentRouteFile))).toBe(false);
    });
  });
});
