// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/demo/route";
import {
  hookInstallPaths,
  installHookKit,
  uninstallAllHookKits,
} from "./install-hooks";
import { agentGuardrailsScenarios } from "./scenarios";
import {
  fileRules,
  installScopedContext,
  nestedAgents,
  scopedContextFiles,
  scopedContextPaths,
  uninstallScopedContext,
} from "./scoped-context";

// Reset runs `git checkout`; parallel test files would collide on .git/index.lock.
vi.mock("./restore-sources", () => ({ restoreDemoSources: () => {} }));

// Other test files share the default sandboxes and run in parallel.
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "marsbank-scoped-context-"));
scopedContextPaths.root = sandbox;
hookInstallPaths.hooksJson = path.join(sandbox, ".cursor/hooks.json");
hookInstallPaths.hooksDir = path.join(sandbox, ".cursor/hooks");

const presenterRule = `---
description: A presenter's own rule
globs: app/api/**
alwaysApply: false
---

Keep this file.
`;

const seeded: Record<string, string> = {
  ".cursor/rules/architecture.mdc": read(path.join(process.cwd(), ".cursor/rules/architecture.mdc")),
  ".cursor/rules/presenter.mdc": presenterRule,
  "AGENTS.md": read(path.join(process.cwd(), "AGENTS.md")),
  "app/api/AGENTS.md": "# app/api\n\nA presenter's own nested file.\n",
  "components/banking/account-list.tsx": read(
    path.join(process.cwd(), "components/banking/account-list.tsx"),
  ),
};

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/demo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function snapshot(): Record<string, string> {
  return Object.fromEntries(
    fs
      .readdirSync(sandbox, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const file = path.join(entry.parentPath, entry.name);
        return [path.relative(sandbox, file), read(file)] as const;
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function frontmatter(source: string): Record<string, string> {
  const block = source.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";
  return Object.fromEntries(
    block.split("\n").map((line) => {
      const at = line.indexOf(":");
      return [line.slice(0, at), line.slice(at + 1).trim()];
    }),
  );
}

function promptFile(id: string): string {
  const card = agentGuardrailsScenarios.find((scenario) => scenario.id === "agent-rules");
  const prompt = card?.prompts.find((block) => block.id === id)?.prompt ?? "";
  return prompt.match(/\b[\w/-]+\.tsx?\b/)?.[0] ?? "";
}

function inFolder(file: string, folder: string): boolean {
  return !path.relative(folder, file).startsWith("..");
}

const installed = scopedContextFiles.map((file) => file.path);
let before: Record<string, string>;

beforeEach(() => {
  for (const [file, source] of Object.entries(seeded)) {
    fs.mkdirSync(path.dirname(path.join(sandbox, file)), { recursive: true });
    fs.writeFileSync(path.join(sandbox, file), source);
  }
  installHookKit("hooks");
  installHookKit("agent-autopilot");
  before = snapshot();
});

afterEach(async () => {
  await post({ action: "reset-all" });
  uninstallAllHookKits();
  for (const entry of fs.readdirSync(sandbox)) {
    fs.rmSync(path.join(sandbox, entry), { recursive: true, force: true });
  }
});

afterAll(() => {
  fs.rmSync(sandbox, { recursive: true, force: true });
});

describe("Rules that load on demand", () => {
  it("Setup adds exactly the two rules and the nested AGENTS.md, and a second Setup changes nothing", async () => {
    expect((await post({ action: "setup", scenario: "agent-rules" })).status).toBe(200);
    const once = snapshot();
    expect(Object.keys(once).sort()).toEqual([...Object.keys(before), ...installed].sort());
    for (const [file, source] of Object.entries(before)) {
      expect(once[file]).toBe(source);
    }

    await post({ action: "setup", scenario: "agent-rules" });
    expect(snapshot()).toEqual(once);
  });

  it("installing twice and removing twice leave the tree as it was", () => {
    installScopedContext();
    const once = snapshot();
    installScopedContext();
    expect(snapshot()).toEqual(once);
    uninstallScopedContext();
    uninstallScopedContext();
    expect(snapshot()).toEqual(before);
  });

  it("Reset restores every file byte for byte and a second Reset changes nothing", async () => {
    await post({ action: "setup", scenario: "agent-rules" });

    await post({ action: "reset", scenario: "agent-rules" });
    expect(snapshot()).toEqual(before);
    await post({ action: "reset", scenario: "agent-rules" });
    expect(snapshot()).toEqual(before);
  });

  it("Reset leaves hooks.json, the root AGENTS.md and other AGENTS.md files alone", async () => {
    await post({ action: "setup", scenario: "agent-rules" });
    await post({ action: "reset", scenario: "agent-rules" });
    const after = snapshot();
    for (const file of [".cursor/hooks.json", "AGENTS.md", "app/api/AGENTS.md"]) {
      expect(after[file]).toBe(before[file]);
    }
  });

  it("Reset all and staging another card remove the installed files too", async () => {
    const withoutHooks = (tree: Record<string, string>) =>
      Object.fromEntries(
        Object.entries(tree).filter(([file]) => !file.startsWith(".cursor/hooks")),
      );
    await post({ action: "setup", scenario: "agent-rules" });
    await post({ action: "setup", scenario: "agent-lint" });
    expect(snapshot()).toEqual(before);

    await post({ action: "setup", scenario: "agent-rules" });
    await post({ action: "reset-all" });
    expect(withoutHooks(snapshot())).toEqual(withoutHooks(before));
  });

  it("installs Apply to Specific Files rules and a nested AGENTS.md that split the three prompts", async () => {
    const staged = await post({ action: "setup", scenario: "agent-rules" });
    const body = (await staged.json()) as { guardrail: { output: string } };
    for (const file of installed) expect(body.guardrail.output).toContain(file);

    for (const rule of fileRules) {
      const meta = frontmatter(read(path.join(sandbox, `.cursor/rules/${rule.name}.mdc`)));
      expect(meta).toEqual({ globs: rule.globs.join(","), alwaysApply: "false" });
    }

    const api = promptFile("api-edit");
    const banking = promptFile("banking-edit");
    const plain = promptFile("plain-edit");
    const matchesAny = (file: string, rule: (typeof fileRules)[number]) =>
      rule.globs.some((glob) => path.matchesGlob(file, glob));
    const [apiRule, testRule] = fileRules;
    if (!apiRule || !testRule) throw new Error("Expected two file rules.");

    expect(api).toBe("app/api/transfers/route.ts");
    expect(matchesAny(api, apiRule)).toBe(true);
    expect(inFolder(api, nestedAgents.folder)).toBe(false);

    expect(banking).toBe("components/banking/account-list.tsx");
    expect(inFolder(banking, nestedAgents.folder)).toBe(true);
    expect(fileRules.some((rule) => matchesAny(banking, rule))).toBe(false);

    expect(plain).toBe("lib/money.ts");
    expect(inFolder(plain, nestedAgents.folder)).toBe(false);
    expect(fileRules.some((rule) => matchesAny(plain, rule))).toBe(false);
  });
});
