#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repo = "bkarciauskas/marsbank";
const label = "demo-example";
const ciJobs = ["typecheck", "lint", "test"];
const waitMs = 6 * 60 * 1000;
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function publicText(text) {
  return text.replace(/x-access-token:[^@\s]+/g, "x-access-token:redacted").trim();
}

function run(command, args, cwd = repoRoot) {
  try {
    const stdout = execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : "";
    const stderr = typeof error.stderr === "string" ? error.stderr : "";
    return { ok: false, stdout, stderr: stderr || error.message };
  }
}

function git(args, cwd = repoRoot) {
  const result = run("git", args, cwd);
  if (!result.ok) {
    throw new Error(publicText(result.stderr || result.stdout || `git ${args[0]} failed`));
  }
  return result.stdout.trim();
}

function gh(args) {
  const result = run("gh", args);
  if (!result.ok) {
    throw new Error(publicText(result.stderr || result.stdout || `gh ${args[0]} failed`));
  }
  return result.stdout.trim();
}

function originSlug() {
  const url = git(["remote", "get-url", "origin"]);
  const match = url.match(/github\.com[:/]([^/\s]+)\/([^/\s.]+)/);
  if (!match) throw new Error("origin is not a github.com repository");
  return `${match[1]}/${match[2]}`;
}

function headRefError(name) {
  if (name === "main" || name === "master") return "refuses to push the default branch";
  if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.includes("..") || name.startsWith("-") || name.endsWith("/")) {
    return "unexpected branch name";
  }
  return null;
}

function cell(value) {
  return value.replaceAll("|", "/");
}

function latestChecks(sha) {
  const body = JSON.parse(gh(["api", `repos/${repo}/commits/${sha}/check-runs?per_page=100`]));
  const runs = Array.isArray(body.check_runs) ? body.check_runs : [];
  const latest = new Map();
  for (const check of runs) {
    if (!ciJobs.includes(check.name)) continue;
    const prev = latest.get(check.name);
    const stamp = check.started_at || check.completed_at || "";
    const prevStamp = prev ? prev.started_at || prev.completed_at || "" : "";
    if (!prev || stamp >= prevStamp) latest.set(check.name, check);
  }
  return ciJobs.map((name) => latest.get(name) ?? null);
}

function verdictOf(checks) {
  if (checks.some((check) => check === null || check.status !== "completed")) return "pending";
  if (checks.every((check) => check.conclusion === "success")) return "green";
  return "red";
}

function ciText(kind, checks) {
  const parts = ciJobs.map((name, index) => {
    const check = checks[index];
    if (!check) return `${name} missing`;
    if (check.status !== "completed") return `${name} ${check.status}`;
    return `${name} ${check.conclusion}`;
  });
  return `${kind}: ${parts.join(", ")}`;
}

async function waitForCi(sha) {
  const deadline = Date.now() + waitMs;
  let checks = latestChecks(sha);
  while (verdictOf(checks) === "pending" && Date.now() < deadline) {
    await sleep(10_000);
    checks = latestChecks(sha);
  }
  return { verdict: verdictOf(checks), checks };
}

function rerunCi(branch, sha) {
  const listed = JSON.parse(
    gh([
      "run",
      "list",
      "--repo",
      repo,
      "--branch",
      branch,
      "--workflow",
      "ci.yml",
      "--limit",
      "5",
      "--json",
      "databaseId,headSha,status",
    ]),
  );
  const match = listed.find((item) => item.headSha === sha);
  if (!match) return { ok: false, detail: "no ci.yml run for this commit" };
  if (match.status !== "completed") return { ok: true, detail: "already running" };
  const result = run("gh", ["run", "rerun", String(match.databaseId), "--repo", repo]);
  if (!result.ok) return { ok: false, detail: publicText(result.stderr || result.stdout).split("\n")[0] };
  return { ok: true, detail: "rerun started" };
}

function conflictFiles(worktree) {
  const listed = run("git", ["diff", "--name-only", "--diff-filter=U"], worktree);
  return listed.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function removeWorktree(directory) {
  run("git", ["rebase", "--abort"], directory);
  run("git", ["worktree", "remove", "--force", directory]);
  rmSync(directory, { recursive: true, force: true });
  run("git", ["worktree", "prune"]);
}

async function refreshOne(pr) {
  const branch = pr.headRefName;
  const refused = headRefError(branch);
  if (refused) return { pr, rebase: refused, ci: "not re-run", bad: true };
  if (pr.baseRefName !== "main") {
    return { pr, rebase: `skipped, base is ${pr.baseRefName}`, ci: "not re-run", bad: true };
  }

  const fetched = run("git", ["fetch", "origin", `refs/heads/${branch}:refs/remotes/origin/${branch}`]);
  if (!fetched.ok) {
    return { pr, rebase: `fetch failed: ${publicText(fetched.stderr).split("\n")[0]}`, ci: "not re-run", bad: true };
  }

  const before = git(["rev-parse", `origin/${branch}`]);
  const directory = mkdtempSync(join(tmpdir(), "demo-example-"));
  try {
    git(["worktree", "add", "--detach", directory, `origin/${branch}`]);
    const rebasing = run("git", ["rebase", "origin/main"], directory);
    if (!rebasing.ok) {
      const files = conflictFiles(directory);
      run("git", ["rebase", "--abort"], directory);
      const detail = files.length > 0 ? files.join(", ") : publicText(rebasing.stderr).split("\n")[0];
      return { pr, rebase: `conflict: ${detail}`, ci: "not re-run", bad: true };
    }

    const after = git(["rev-parse", "HEAD"], directory);
    if (after === before) {
      const again = rerunCi(branch, after);
      if (!again.ok) {
        const checks = latestChecks(after);
        const previous = verdictOf(checks);
        return {
          pr,
          rebase: "already on main",
          ci: `not re-run (${again.detail}); previous ${previous === "pending" ? ciText(previous, checks) : previous}`,
          bad: true,
        };
      }
      const waited = await waitForCi(after);
      return {
        pr,
        rebase: "already on main",
        ci: ciText(waited.verdict, waited.checks),
        bad: waited.verdict !== "green",
      };
    }

    const pushed = run(
      "git",
      ["push", `--force-with-lease=refs/heads/${branch}:${before}`, "origin", `HEAD:refs/heads/${branch}`],
      directory,
    );
    if (!pushed.ok) {
      return {
        pr,
        rebase: `push refused: ${publicText(pushed.stderr || pushed.stdout).split("\n")[0]}`,
        ci: "not re-run",
        bad: true,
      };
    }
    const waited = await waitForCi(after);
    return {
      pr,
      rebase: "pushed",
      ci: ciText(waited.verdict, waited.checks),
      bad: waited.verdict !== "green",
    };
  } finally {
    removeWorktree(directory);
  }
}

function printTable(rows) {
  console.log("| PR | Branch | Rebase | CI |");
  console.log("| --- | --- | --- | --- |");
  for (const row of rows) {
    console.log(`| #${row.pr.number} | ${cell(row.pr.headRefName)} | ${cell(row.rebase)} | ${cell(row.ci)} |`);
  }
}

const slug = originSlug();
if (slug !== repo) throw new Error(`origin is ${slug}`);

git(["fetch", "origin", "refs/heads/main:refs/remotes/origin/main"]);

const prs = JSON.parse(
  gh([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    label,
    "--limit",
    "50",
    "--json",
    "number,title,headRefName,baseRefName",
  ]),
).sort((a, b) => a.number - b.number);

if (prs.length === 0) {
  console.log("No open pull requests labeled demo-example.");
  process.exitCode = 1;
} else {
  const rows = [];
  for (const pr of prs) {
    console.error(`#${pr.number} ${pr.headRefName}`);
    try {
      rows.push(await refreshOne(pr));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rows.push({ pr, rebase: `error: ${message}`, ci: "not re-run", bad: true });
    }
  }
  printTable(rows);
  if (rows.some((row) => row.bad)) process.exitCode = 1;
}
