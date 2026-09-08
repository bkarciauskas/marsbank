#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join } from "node:path";
import {
  evidenceRoot,
  instancePath,
  listeningPids,
  loadInstance,
  pidAlive,
  removeInstanceFile,
  repoRoot,
  runDir,
} from "./lib.mjs";

const nextDistDir = join(repoRoot, ".next-verify");

function restoreGeneratedNextTypes() {
  try {
    execFileSync("git", ["checkout", "--", "next-env.d.ts", "tsconfig.json"], {
      cwd: repoRoot,
      stdio: "ignore",
    });
  } catch {}
}

function removeGeneratedNextState() {
  rmSync(nextDistDir, { recursive: true, force: true });
  restoreGeneratedNextTypes();
}

const instance = loadInstance();
if (!instance) {
  removeGeneratedNextState();
  console.log("Cleanup: no recorded verification instance. Nothing to tear down.");
  console.log(`Evidence directory left in place at ${evidenceRoot}`);
  process.exit(0);
}

const pids = new Set();
if (instance.pid) pids.add(instance.pid);
for (const pid of listeningPids(instance.port)) {
  pids.add(pid);
}

for (const pid of pids) {
  if (!pidAlive(pid)) continue;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

const deadline = Date.now() + 8_000;
while (Date.now() < deadline) {
  const still = [...pids].filter((pid) => pidAlive(pid));
  if (still.length === 0) break;
  await new Promise((resolve) => setTimeout(resolve, 150));
}

for (const pid of pids) {
  if (!pidAlive(pid)) continue;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

const leftoverDeadline = Date.now() + 2_000;
let leftover = listeningPids(instance.port);
while (leftover.length > 0 && Date.now() < leftoverDeadline) {
  await new Promise((resolve) => setTimeout(resolve, 150));
  leftover = listeningPids(instance.port);
}
if (leftover.length > 0) {
  console.error(
    `Cleanup: port ${instance.port} still has listeners ${leftover.join(", ")}. Keeping ${instancePath} so a retry can stop this run. Evidence was not deleted.`,
  );
  process.exit(1);
}

rmSync(runDir, { recursive: true, force: true });
removeInstanceFile();
removeGeneratedNextState();

console.log(`Cleanup: stopped run ${instance.runId} on ${instance.baseUrl}.`);
console.log(`Evidence retained at ${evidenceRoot}`);
console.log(`Instance file removed: ${instancePath}`);
