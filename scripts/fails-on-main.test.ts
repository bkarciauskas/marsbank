// @vitest-environment node
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyPr,
  evaluateFailsOnMain,
  isDocsFile,
  isTestFile,
} from "./fails-on-main.mjs";

const repoRoot = resolve(".");
const vitestBin = join(repoRoot, "node_modules", "vitest", "vitest.mjs");
const headNodeModules = join(repoRoot, "node_modules");
const tempDirs: string[] = [];

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), "fails-on-main-test-"));
  tempDirs.push(dir);
  const git = (args: string[]) =>
    execFileSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.com",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

  git(["init", "-b", "main"]);
  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify({ name: "tmp-repo", type: "module" }, null, 2),
  );
  writeFileSync(join(dir, "package-lock.json"), "{}\n");
  writeFileSync(
    join(dir, "vitest.config.ts"),
    'import { defineConfig } from "vitest/config";\nexport default defineConfig({ test: { environment: "node" } });\n',
  );
  mkdirSync(join(dir, "lib"), { recursive: true });
  writeFileSync(
    join(dir, "lib", "math.ts"),
    "export function add(a: number, b: number) {\n  return a - b;\n}\n",
  );
  writeFileSync(
    join(dir, "lib", "math.test.ts"),
    'import { expect, it } from "vitest";\nimport { add } from "./math";\n\nit("returns a number", () => {\n  expect(typeof add(2, 1)).toBe("number");\n});\n',
  );
  git(["add", "."]);
  git(["commit", "-m", "initial buggy main"]);
  symlinkSync(headNodeModules, join(dir, "node_modules"), "dir");

  return { dir, git };
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("classifyPr", () => {
  it("requires proof when PR carries a bug label", () => {
    expect(
      classifyPr({
        title: "MARS-15: Prevent duplicate retry",
        labels: ["bug"],
        headRef: "cursor/retry-fix-1234",
        changedFiles: ["lib/ledger.ts"],
      }).required,
    ).toBe(true);
  });

  it("requires proof for conventional fix titles and fix branches", () => {
    expect(
      classifyPr({
        title: "fix(ledger): debit available on offset transfer",
        labels: [],
        headRef: "cursor/offset-hold-1234",
        changedFiles: ["lib/ledger.ts"],
      }).required,
    ).toBe(true);

    expect(
      classifyPr({
        title: "Handle retry timeout",
        labels: [],
        headRef: "fix/retry-timeout",
        changedFiles: ["lib/ledger.ts"],
      }).required,
    ).toBe(true);
  });

  it("skips non-bug-fix PRs including feature, docs, chore, and demo-example PRs", () => {
    expect(
      classifyPr({
        title: "feat(accounts): open goal savings vaults and linked offsets (MARS-4)",
        labels: ["demo-example"],
        headRef: "cursor/goal-savings-vaults-136e",
        changedFiles: ["lib/ledger.ts", "lib/ledger.test.ts"],
      }).required,
    ).toBe(false);

    expect(
      classifyPr({
        title: "MARS-1: Saved Payee Directory & Recent Counterparties",
        labels: ["demo-example"],
        headRef: "cursor/saved-payee-contacts-1c81",
        changedFiles: ["components/banking/transfer-form.tsx"],
      }).required,
    ).toBe(false);

    expect(
      classifyPr({
        title: "docs(skills): fix typo in SKILL.md",
        labels: [],
        headRef: "cursor/docs-typo-1111",
        changedFiles: ["README.md"],
      }).required,
    ).toBe(false);
  });

  it("skips docs-only fix: PRs when no bug label is set", () => {
    expect(
      classifyPr({
        title: "fix: typo in README",
        labels: [],
        headRef: "cursor/readme-typo-1111",
        changedFiles: ["README.md"],
      }).required,
    ).toBe(false);

    expect(
      classifyPr({
        title: "fix: typo in README",
        labels: ["bug"],
        headRef: "cursor/readme-typo-1111",
        changedFiles: ["README.md"],
      }).required,
    ).toBe(true);
  });

  it("identifies Vitest test files and docs files", () => {
    expect(isTestFile("lib/ledger.offset-available.test.ts")).toBe(true);
    expect(isTestFile("app/banking/accounts/[accountId]/page.test.tsx")).toBe(true);
    expect(isTestFile("lib/ledger.ts")).toBe(false);
    expect(isDocsFile("docs/plan.md")).toBe(true);
    expect(isDocsFile("lib/ledger.ts")).toBe(false);
  });
});

describe("evaluateFailsOnMain", () => {
  it("passes when a bug-fix PR test fails on main and passes on PR head", () => {
    const { dir, git } = createTempRepo();
    git(["checkout", "-b", "fix/add"]);
    writeFileSync(
      join(dir, "lib", "math.ts"),
      "export function add(a: number, b: number) {\n  return a + b;\n}\n",
    );
    writeFileSync(
      join(dir, "lib", "math.regression.test.ts"),
      'import { expect, it } from "vitest";\nimport { add } from "./math";\n\nit("adds positive numbers", () => {\n  expect(add(2, 3)).toBe(5);\n});\n',
    );
    git(["add", "."]);
    git(["commit", "-m", "fix(math): add instead of subtract"]);

    const result = evaluateFailsOnMain({
      repoRoot: dir,
      title: "fix(math): add instead of subtract",
      labels: [],
      headRef: "fix/add",
      baseCommit: "main",
      baseLabel: "main",
      vitestBin,
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.testFiles).toEqual(["lib/math.regression.test.ts"]);
    expect(result.headRun?.ok).toBe(true);
    expect(result.baseRun?.ok).toBe(false);
  });

  it("fails when a bug-fix PR modifies no test files", () => {
    const { dir, git } = createTempRepo();
    git(["checkout", "-b", "fix/no-test"]);
    writeFileSync(
      join(dir, "lib", "math.ts"),
      "export function add(a: number, b: number) {\n  return a + b;\n}\n",
    );
    git(["add", "."]);
    git(["commit", "-m", "fix(math): fix without test"]);

    const result = evaluateFailsOnMain({
      repoRoot: dir,
      title: "fix(math): fix without test",
      labels: ["bug"],
      headRef: "fix/no-test",
      baseCommit: "main",
      baseLabel: "main",
      vitestBin,
    });

    expect(result.ok).toBe(false);
    expect(result.testFiles).toEqual([]);
    expect(result.reason).toContain("no added or modified test files");
  });

  it("fails when the bug-fix PR test also passes on main", () => {
    const { dir, git } = createTempRepo();
    git(["checkout", "-b", "fix/weak-test"]);
    writeFileSync(
      join(dir, "lib", "math.ts"),
      "export function add(a: number, b: number) {\n  return a + b;\n}\n",
    );
    writeFileSync(
      join(dir, "lib", "math.test.ts"),
      'import { expect, it } from "vitest";\nimport { add } from "./math";\n\nit("returns 0 when second arg is 0", () => {\n  expect(add(5, 0)).toBe(5);\n});\n',
    );
    git(["add", "."]);
    git(["commit", "-m", "fix(math): test passes on main too"]);

    const result = evaluateFailsOnMain({
      repoRoot: dir,
      title: "fix(math): test passes on main too",
      labels: [],
      headRef: "fix/weak-test",
      baseCommit: "main",
      baseLabel: "main",
      vitestBin,
    });

    expect(result.ok).toBe(false);
    expect(result.headRun?.ok).toBe(true);
    expect(result.baseRun?.ok).toBe(true);
    expect(result.reason).toContain("passed on main");
  });

  it("fails when the bug-fix PR test fails on PR head", () => {
    const { dir, git } = createTempRepo();
    git(["checkout", "-b", "fix/broken-head"]);
    writeFileSync(
      join(dir, "lib", "math.regression.test.ts"),
      'import { expect, it } from "vitest";\nimport { add } from "./math";\n\nit("adds positive numbers", () => {\n  expect(add(2, 3)).toBe(5);\n});\n',
    );
    git(["add", "."]);
    git(["commit", "-m", "fix(math): forgot the fix"]);

    const result = evaluateFailsOnMain({
      repoRoot: dir,
      title: "fix(math): forgot the fix",
      labels: ["bug"],
      headRef: "fix/broken-head",
      baseCommit: "main",
      baseLabel: "main",
      vitestBin,
    });

    expect(result.ok).toBe(false);
    expect(result.headRun?.ok).toBe(false);
    expect(result.reason).toContain("failed on the PR head");
  });

  it("skips cleanly for non-bug-fix PRs", () => {
    const { dir, git } = createTempRepo();
    git(["checkout", "-b", "feat/docs"]);
    writeFileSync(join(dir, "README.md"), "# Mars Bank\n");
    git(["add", "."]);
    git(["commit", "-m", "docs: add readme"]);

    const result = evaluateFailsOnMain({
      repoRoot: dir,
      title: "docs: add readme",
      labels: [],
      headRef: "feat/docs",
      baseCommit: "main",
      baseLabel: "main",
      vitestBin,
    });

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
  });
});
