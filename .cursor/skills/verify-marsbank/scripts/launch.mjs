#!/usr/bin/env node
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { join } from "node:path";
import {
  configuredHost,
  configuredPort,
  ensureDir,
  fail,
  listeningPids,
  loadInstance,
  nowStamp,
  pidAlive,
  repoRoot,
  runDir,
  saveInstance,
  waitForHttp,
} from "./lib.mjs";

const host = configuredHost();
const port = configuredPort();
const baseUrl = `http://${host}:${port}`;
const existing = loadInstance();

if (existing && pidAlive(existing.pid)) {
  fail(
    `A verification instance is already recorded at ${existing.baseUrl} (pid ${existing.pid}). Run scripts/cleanup.mjs first, or drive that instance after scripts/doctor.mjs.`,
  );
}

const occupants = listeningPids(port);
if (occupants.length > 0) {
  fail(
    `Port ${port} is already in use by pid(s) ${occupants.join(", ")}. Do not attach to a shared Mars Bank. Pick another MARSBANK_VERIFY_PORT or free this port.`,
  );
}

ensureDir(runDir);
const runId = nowStamp();
const logPath = join(runDir, "next.log");
const logFd = openSync(logPath, "w");

const child = spawn(
  "npm",
  ["run", "dev", "--", "--hostname", host, "--port", String(port)],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(port),
      BROWSER: "none",
      NEXT_TELEMETRY_DISABLED: "1",
      MARSBANK_NEXT_DIST_DIR: ".next-verify",
    },
    stdio: ["ignore", logFd, logFd],
    detached: true,
  },
);
child.unref();

const instance = {
  runId,
  pid: child.pid,
  host,
  port,
  baseUrl,
  startedAt: new Date().toISOString(),
  logPath,
  cwd: repoRoot,
};
saveInstance(instance);

child.on("exit", (code, signal) => {
  const latest = loadInstance();
  if (latest?.pid === child.pid) {
    saveInstance({ ...latest, exitedAt: new Date().toISOString(), exitCode: code, signal });
  }
});

try {
  await waitForHttp(`${baseUrl}/login`, {
    timeoutMs: 120_000,
    ok: (status) => status === 200,
  });
} catch (error) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      process.kill(child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  fail(`Launch failed: ${error instanceof Error ? error.message : error}. See ${logPath}.`);
}

console.log(`Mars Bank verification instance ready at ${baseUrl}`);
console.log(`runId=${runId} pid=${child.pid} log=${logPath}`);
process.exit(0);
