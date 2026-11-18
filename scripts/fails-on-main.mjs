#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  appendFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const BUG_LABELS = new Set(["bug", "bugfix", "bug-fix"]);
const BUG_TITLE_PATTERN = /^(?:fix|bugfix|hotfix|bug)(?:\([^)]+\))?!?:/i;
const BUG_BRACKET_PATTERN = /^\[(?:fix|bugfix|hotfix|bug)\]/i;
const BUG_BRANCH_PATTERN = /^(?:fix|bugfix|hotfix)\//i;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const DOCS_FILE_PATTERN = /\.(?:md|mdx)$/i;

/** @param {string} filePath */
export function isTestFile(filePath) {
  return TEST_FILE_PATTERN.test(filePath);
}

/** @param {string} filePath */
export function isOverlayHelperFile(filePath) {
  return filePath.startsWith("test-utils/");
}

/** @param {string} filePath */
export function isDocsFile(filePath) {
  return DOCS_FILE_PATTERN.test(filePath);
}

/**
 * @param {{
 *   title?: string;
 *   labels?: string[];
 *   headRef?: string;
 *   changedFiles?: string[];
 * }} input
 * @returns {{ required: boolean; reason: string }}
 */
export function classifyPr({ title = "", labels = [], headRef = "", changedFiles = [] }) {
  const matchedLabel = labels.find((label) => BUG_LABELS.has(label.trim().toLowerCase()));
  if (matchedLabel) {
    return { required: true, reason: `PR carries bug label "${matchedLabel}"` };
  }

  const trimmedTitle = title.trim();
  const titleMatches =
    BUG_TITLE_PATTERN.test(trimmedTitle) || BUG_BRACKET_PATTERN.test(trimmedTitle);
  const branchMatches = BUG_BRANCH_PATTERN.test(headRef.trim());

  if (!titleMatches && !branchMatches) {
    return { required: false, reason: "PR is not classified as a bug fix" };
  }

  if (changedFiles.length > 0 && changedFiles.every(isDocsFile)) {
    return { required: false, reason: "docs-only change without a bug label" };
  }

  return {
    required: true,
    reason: titleMatches
      ? `PR title "${trimmedTitle}" indicates a bug fix`
      : `PR branch "${headRef}" indicates a bug fix`,
  };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {Record<string, string | undefined>} [extraEnv]
 */
function runCommand(command, args, cwd, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const output = [stdout, stderr].filter(Boolean).join("\n").trim();
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout,
    stderr,
    output,
  };
}

/**
 * @param {string} repoRoot
 * @param {string[]} args
 */
function git(repoRoot, args) {
  const res = runCommand("git", args, repoRoot);
  if (!res.ok) {
    throw new Error(res.output || `git ${args[0]} failed`);
  }
  return res.stdout;
}

/**
 * @param {string} repoRoot
 * @param {string} ref
 */
function commitExists(repoRoot, ref) {
  if (!ref) return false;
  return runCommand("git", ["cat-file", "-e", `${ref}^{commit}`], repoRoot).ok;
}

/**
 * @param {{ repoRoot: string; baseRef: string; headRef: string }} options
 * @returns {string[]}
 */
export function resolveChangedFiles({ repoRoot, baseRef, headRef }) {
  let diff = runCommand(
    "git",
    ["diff", "--name-only", "-z", "--diff-filter=ACMR", `${baseRef}...${headRef}`],
    repoRoot,
  );
  if (!diff.ok) {
    diff = runCommand(
      "git",
      ["diff", "--name-only", "-z", "--diff-filter=ACMR", `${baseRef}..${headRef}`],
      repoRoot,
    );
  }
  if (!diff.ok) {
    throw new Error(`Failed to diff ${baseRef} and ${headRef}: ${diff.output}`);
  }
  return diff.stdout
    .split("\0")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

/**
 * @param {{ repoRoot: string; baseCommit: string; headCommit: string; paths: string[] }} options
 * @returns {boolean}
 */
function pathsDiffer({ repoRoot, baseCommit, headCommit, paths }) {
  const diff = runCommand(
    "git",
    ["diff", "--name-only", `${baseCommit}..${headCommit}`, "--", ...paths],
    repoRoot,
  );
  if (!diff.ok) return true;
  return diff.stdout.trim().length > 0;
}

/**
 * @param {{ cwd: string; testFiles: string[]; vitestBin: string }} options
 * @returns {{ ok: boolean; status: number; output: string }}
 */
export function runVitest({ cwd, testFiles, vitestBin }) {
  /** @type {Record<string, string | undefined>} */
  const cleanEnv = { ...process.env, CI: "1" };
  delete cleanEnv.VITEST;
  delete cleanEnv.VITEST_POOL_ID;
  delete cleanEnv.VITEST_WORKER_ID;

  const result = spawnSync(
    process.execPath,
    [vitestBin, "run", ...testFiles],
    {
      cwd,
      env: cleanEnv,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    output: [stdout, stderr].filter(Boolean).join("\n").trim(),
  };
}

/**
 * @param {{
 *   repoRoot?: string;
 *   title?: string;
 *   labels?: string[];
 *   headRef?: string;
 *   baseCommit?: string;
 *   diffBase?: string;
 *   diffHead?: string;
 *   baseLabel?: string;
 *   vitestBin?: string;
 * }} options
 */
export function evaluateFailsOnMain(options = {}) {
  const repoRoot = resolve(options.repoRoot ?? process.cwd());
  const title = options.title ?? "";
  const labels = options.labels ?? [];
  const headRef = options.headRef ?? "";
  const baseCommit = options.baseCommit ?? "origin/main";
  const diffBase = options.diffBase ?? baseCommit;
  const diffHead = options.diffHead ?? "HEAD";
  const baseLabel = options.baseLabel ?? "main";
  const vitestBin =
    options.vitestBin ?? join(repoRoot, "node_modules", "vitest", "vitest.mjs");

  const changedFiles = resolveChangedFiles({
    repoRoot,
    baseRef: diffBase,
    headRef: diffHead,
  });

  const classification = classifyPr({ title, labels, headRef, changedFiles });
  if (!classification.required) {
    return {
      ok: true,
      skipped: true,
      reason: classification.reason,
      changedFiles,
      testFiles: /** @type {string[]} */ ([]),
      baseLabel,
    };
  }

  const testFiles = changedFiles.filter(
    (file) => isTestFile(file) && existsSync(join(repoRoot, file)),
  );
  if (testFiles.length === 0) {
    return {
      ok: false,
      skipped: false,
      reason: `Bug-fix PR has no added or modified test files. Add a reproduction test that fails on ${baseLabel} and passes on the PR.`,
      changedFiles,
      testFiles,
      baseLabel,
    };
  }

  const headRun = runVitest({ cwd: repoRoot, testFiles, vitestBin });
  if (!headRun.ok) {
    return {
      ok: false,
      skipped: false,
      reason: "Changed test(s) failed on the PR head.",
      changedFiles,
      testFiles,
      baseLabel,
      headRun,
    };
  }

  const overlayFiles = changedFiles.filter(
    (file) =>
      (isTestFile(file) || isOverlayHelperFile(file)) &&
      existsSync(join(repoRoot, file)),
  );

  const isolatedHooks = mkdtempSync(join(tmpdir(), "fails-on-main-hooks-"));
  const baseDir = mkdtempSync(join(tmpdir(), "fails-on-main-base-"));

  try {
    const hookArgs = ["-c", `core.hooksPath=${isolatedHooks}`];
    git(repoRoot, [...hookArgs, "worktree", "add", "--detach", baseDir, baseCommit]);

    const depsChanged = pathsDiffer({
      repoRoot,
      baseCommit,
      headCommit: "HEAD",
      paths: ["package.json", "package-lock.json"],
    });

    if (depsChanged) {
      const install = runCommand("npm", ["ci", "--no-audit", "--no-fund"], baseDir);
      if (!install.ok) {
        throw new Error(`npm ci failed in ${baseLabel} worktree:\n${install.output}`);
      }
    } else {
      const headNodeModules = join(repoRoot, "node_modules");
      if (!existsSync(headNodeModules)) {
        throw new Error(`Missing node_modules at ${headNodeModules}`);
      }
      symlinkSync(headNodeModules, join(baseDir, "node_modules"), "dir");
    }

    for (const relPath of overlayFiles) {
      const target = join(baseDir, relPath);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(repoRoot, relPath), target);
    }

    const baseVitestBin = depsChanged
      ? join(baseDir, "node_modules", "vitest", "vitest.mjs")
      : vitestBin;
    const baseRun = runVitest({ cwd: baseDir, testFiles, vitestBin: baseVitestBin });

    if (baseRun.ok) {
      return {
        ok: false,
        skipped: false,
        reason: `Changed test(s) passed on ${baseLabel}, so they do not prove the bug existed on ${baseLabel}.`,
        changedFiles,
        testFiles,
        baseLabel,
        headRun,
        baseRun,
      };
    }

    return {
      ok: true,
      skipped: false,
      reason: `Verified: changed test(s) failed on ${baseLabel} and passed on the PR head.`,
      changedFiles,
      testFiles,
      baseLabel,
      headRun,
      baseRun,
    };
  } finally {
    runCommand("git", ["-c", `core.hooksPath=${isolatedHooks}`, "worktree", "remove", "--force", baseDir], repoRoot);
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(isolatedHooks, { recursive: true, force: true });
    runCommand("git", ["worktree", "prune"], repoRoot);
  }
}

/** @param {string} repoRoot */
function loadPrMetadataFromEnvAndGitHub(repoRoot) {
  let title = process.env.PR_TITLE ?? "";
  let headRef = process.env.PR_HEAD_REF ?? "";
  let headSha = process.env.PR_HEAD_SHA ?? "";
  let baseRef = process.env.PR_BASE_REF ?? "main";
  let baseSha = process.env.PR_BASE_SHA ?? "";
  /** @type {string[]} */
  let labels = [];

  if (process.env.PR_LABELS_JSON) {
    try {
      const parsed = JSON.parse(process.env.PR_LABELS_JSON);
      if (Array.isArray(parsed)) {
        labels = parsed.filter((item) => typeof item === "string");
      }
    } catch {
      labels = [];
    }
  }

  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const prNumber = process.env.PR_NUMBER ?? "";
  if (process.env.GH_TOKEN && repo && prNumber) {
    try {
      const raw = execFileSync(
        "gh",
        ["api", `repos/${repo}/pulls/${prNumber}`],
        { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
      const pr = JSON.parse(raw);
      if (typeof pr.title === "string") title = pr.title;
      if (Array.isArray(pr.labels)) {
        labels = pr.labels
          .map((item) => (typeof item?.name === "string" ? item.name : ""))
          .filter(Boolean);
      }
      if (typeof pr.head?.ref === "string") headRef = pr.head.ref;
      if (typeof pr.head?.sha === "string") headSha = pr.head.sha;
      if (typeof pr.base?.ref === "string") baseRef = pr.base.ref;
      if (typeof pr.base?.sha === "string") baseSha = pr.base.sha;
    } catch {
      // Fall back to event payload env vars if API call fails.
    }
  }

  return { title, labels, headRef, headSha, baseRef, baseSha, prNumber };
}

/** @param {ReturnType<typeof evaluateFailsOnMain>} result */
function writeStepSummary(result) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const lines = [
    `### fails-on-main`,
    "",
    `- **Outcome:** ${result.ok ? "PASS" : "FAIL"}`,
    `- **Reason:** ${result.reason}`,
  ];
  if (result.testFiles.length > 0) {
    lines.push(`- **Tests checked:** ${result.testFiles.map((f) => `\`${f}\``).join(", ")}`);
  }
  if (result.headRun) {
    lines.push(`- **PR head run:** ${result.headRun.ok ? "passed" : `failed (exit ${result.headRun.status})`}`);
  }
  if (result.baseRun) {
    lines.push(
      `- **${result.baseLabel} run:** ${result.baseRun.ok ? "passed (unexpected)" : `failed as expected (exit ${result.baseRun.status})`}`,
    );
  }
  lines.push("");
  appendFileSync(summaryFile, `${lines.join("\n")}\n`);
}

function startedAsScript() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(entry);
  } catch {
    return false;
  }
}

function main() {
  const repoRoot = resolve(process.cwd());
  const meta = loadPrMetadataFromEnvAndGitHub(repoRoot);

  const hasOrigin = runCommand("git", ["remote", "get-url", "origin"], repoRoot).ok;
  if (hasOrigin && meta.baseRef) {
    runCommand(
      "git",
      ["fetch", "--no-tags", "origin", `refs/heads/${meta.baseRef}:refs/remotes/origin/${meta.baseRef}`],
      repoRoot,
    );
  }

  const originBase = `origin/${meta.baseRef}`;
  const baseCommit = commitExists(repoRoot, originBase)
    ? originBase
    : commitExists(repoRoot, meta.baseSha)
      ? meta.baseSha
      : meta.baseRef;

  if (meta.headSha && !commitExists(repoRoot, meta.headSha) && hasOrigin && meta.prNumber) {
    runCommand(
      "git",
      ["fetch", "--no-tags", "origin", `refs/pull/${meta.prNumber}/head`],
      repoRoot,
    );
  }

  const diffHead = commitExists(repoRoot, meta.headSha) ? meta.headSha : "HEAD";
  const diffBase = commitExists(repoRoot, meta.baseSha) ? meta.baseSha : baseCommit;

  const result = evaluateFailsOnMain({
    repoRoot,
    title: meta.title,
    labels: meta.labels,
    headRef: meta.headRef,
    baseCommit,
    diffBase,
    diffHead,
    baseLabel: meta.baseRef || "main",
  });

  writeStepSummary(result);

  console.log(result.reason);
  if (result.testFiles.length > 0) {
    console.log(`Checked test file(s): ${result.testFiles.join(", ")}`);
  }
  if (result.headRun?.output) {
    console.log(`\n--- PR head vitest output (exit ${result.headRun.status}) ---\n${result.headRun.output}`);
  }
  if (result.baseRun?.output) {
    console.log(`\n--- ${result.baseLabel} vitest output (exit ${result.baseRun.status}) ---\n${result.baseRun.output}`);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (startedAsScript()) {
  main();
}
