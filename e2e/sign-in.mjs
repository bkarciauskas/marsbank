#!/usr/bin/env node
// Signs in as Aaron and opens Accounts. Starts its own Next server.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const trackedWhileDev = ["next-env.d.ts", "tsconfig.json"];
const snapshots = new Map(
  trackedWhileDev.map((file) => [file, readFileSync(join(repoRoot, file))]),
);

function restoreTracked() {
  for (const [file, contents] of snapshots) {
    writeFileSync(join(repoRoot, file), contents);
  }
}
const host = "127.0.0.1";
const port = Number(process.env.MARSBANK_E2E_PORT ?? 4173);
const baseUrl = `http://${host}:${port}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForLogin(child) {
  const deadline = Date.now() + 120_000;
  let last = "no response yet";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next exited (${child.exitCode}) before /login was ready. Last: ${last}`);
    }
    try {
      const response = await fetch(`${baseUrl}/login`);
      if (response.status === 200) return;
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${baseUrl}/login. Last: ${last}`);
}

function stop(child) {
  if (!child.pid || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

const nextBin = join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const child = spawn(
  process.execPath,
  [nextBin, "dev", "--hostname", host, "--port", String(port)],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      PATH: `${dirname(process.execPath)}${delimiter}${process.env.PATH ?? ""}`,
      NEXT_TELEMETRY_DISABLED: "1",
      MARSBANK_NEXT_DIST_DIR: ".next-e2e",
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);

let log = "";
const collect = (chunk) => {
  log += chunk.toString();
  if (log.length > 80_000) log = log.slice(-40_000);
};
child.stdout?.on("data", collect);
child.stderr?.on("data", collect);

let browser;
try {
  await waitForLogin(child);
  browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: /aaron/i }) })
    .click();
  const email = page.locator("#mars-bank-id");
  const filled = await email.inputValue();
  if (filled !== "aaron@marsbank.mars") {
    throw new Error(`Expected Aaron's Mars Bank ID, saw ${filled}`);
  }
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking");
  await page
    .getByRole("heading", { name: /Good (morning|afternoon|evening), Aaron/ })
    .waitFor({ timeout: 15_000 });
  await page
    .getByRole("navigation", { name: "Banking" })
    .getByRole("link", { name: "Accounts" })
    .click();
  await page.waitForURL("**/banking/accounts");
  await page.getByRole("heading", { name: "Token register" }).waitFor();
  await page.getByRole("link", { name: /Sol Account/ }).waitFor();
  const heading = await page.getByRole("heading", { level: 1 }).innerText();
  console.log(JSON.stringify({ ok: true, url: page.url(), heading }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  console.error(log.slice(-4000));
  process.exitCode = 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  stop(child);
  restoreTracked();
}

process.exit(process.exitCode ?? 0);
