#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const skillRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = join(skillRoot, "..", "..", "..");
export const runDir = join(skillRoot, ".run");
export const instancePath = join(runDir, "instance.json");
export const evidenceRoot = join(skillRoot, "evidence");

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 4317;

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

export function loadInstance() {
  if (!existsSync(instancePath)) {
    return null;
  }
  return JSON.parse(readFileSync(instancePath, "utf8"));
}

export function saveInstance(instance) {
  ensureDir(runDir);
  writeFileSync(instancePath, `${JSON.stringify(instance, null, 2)}\n`);
}

export function removeInstanceFile() {
  rmSync(instancePath, { force: true });
}

export function configuredPort() {
  const raw = process.env.MARSBANK_VERIFY_PORT;
  if (!raw) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`MARSBANK_VERIFY_PORT must be an integer port, got ${raw}`);
  }
  return port;
}

export function configuredHost() {
  return process.env.MARSBANK_VERIFY_HOST || DEFAULT_HOST;
}

export function baseUrlFrom(instance) {
  return instance?.baseUrl ?? `http://${configuredHost()}:${configuredPort()}`;
}

export function pidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function listeningPids(port) {
  const pids = new Set();
  try {
    const out = execFileSync(
      "lsof",
      ["-iTCP:" + String(port), "-sTCP:LISTEN", "-n", "-P", "-t"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    for (const line of out.split(/\s+/)) {
      const pid = Number(line);
      if (Number.isInteger(pid) && pid > 0) pids.add(pid);
    }
  } catch {
    // lsof is optional; netstat is the fallback below
  }
  if (pids.size === 0) {
    try {
      const out = execFileSync("netstat", ["-lntp"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const needle = `:${port} `;
      for (const line of out.split("\n")) {
        if (!line.includes(needle) || !line.includes("LISTEN")) continue;
        const match = line.match(/(\d+)\//);
        if (match) pids.add(Number(match[1]));
      }
    } catch {
      // port tools are optional when HTTP already proves the instance
    }
  }
  return [...pids];
}

export async function fetchText(url, init) {
  const response = await fetch(url, init);
  const body = await response.text();
  return { response, body };
}

export async function waitForHttp(url, { timeoutMs = 90_000, ok = (status) => status < 500 } = {}) {
  const started = Date.now();
  let lastError = "no attempt";
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (ok(response.status)) {
        return response;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

export function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function fail(message) {
  console.error(message);
  process.exit(1);
}

export async function launchChromium(options = {}) {
  const { chromium } = await import("playwright");
  const bundled = existsSync(chromium.executablePath());
  return chromium.launch({ ...(bundled ? {} : { channel: "chrome" }), ...options });
}
