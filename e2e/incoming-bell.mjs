#!/usr/bin/env node
// Two browsers: Aaron sends Ben tokens, Ben's bell lights up on the register
// poll, then Ben marks it read. Starts its own Next server.
// MARSBANK_E2E_EVIDENCE=<dir> also saves screenshots and a recording of Ben's browser.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, delimiter, resolve } from "node:path";
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
const port = Number(process.env.MARSBANK_E2E_BELL_PORT ?? 4174);
const baseUrl = `http://${host}:${port}`;
// lib/store.tsx polls /api/register every 5s; allow one request round-trip on top.
const refreshWindowMs = 5_000;
const slackMs = 2_000;
const evidenceDir = process.env.MARSBANK_E2E_EVIDENCE
  ? resolve(process.env.MARSBANK_E2E_EVIDENCE)
  : null;

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

async function signIn(page, resident, givenName) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded" });
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: new RegExp(resident, "i") }) })
    .click();
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking");
  await page
    .getByRole("heading", {
      name: new RegExp(`Good (morning|afternoon|evening), ${givenName}`),
    })
    .waitFor({ timeout: 15_000 });
}

async function shot(page, name) {
  if (!evidenceDir) return;
  await page.screenshot({ path: join(evidenceDir, name) });
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

const launch = () =>
  chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
const viewport = { width: 1440, height: 900 };

let senderBrowser;
let recipientBrowser;
let recipientContext;
try {
  if (evidenceDir) mkdirSync(evidenceDir, { recursive: true });
  await waitForLogin(child);
  [senderBrowser, recipientBrowser] = await Promise.all([launch(), launch()]);
  const sender = await (await senderBrowser.newContext({ viewport })).newPage();
  recipientContext = await recipientBrowser.newContext({
    viewport,
    ...(evidenceDir ? { recordVideo: { dir: evidenceDir, size: viewport } } : {}),
  });
  const recipient = await recipientContext.newPage();

  await signIn(recipient, "ben", "Ben");
  const quietBell = recipient.getByRole("button", { name: "Notifications", exact: true });
  await quietBell.waitFor();
  await recipient.waitForLoadState("networkidle");
  await shot(recipient, "01-bell-before.png");

  await signIn(sender, "aaron", "Aaron");
  await sender.goto(`${baseUrl}/banking/transfer`, { waitUntil: "domcontentloaded" });
  await sender.locator("#transfer-payid").fill("ben@marsbank.mars");
  await sender.getByPlaceholder("0").fill("250");
  await sender.locator("#transfer-description").fill("Dust filters");
  await sender.getByRole("button", { name: "Review route" }).click();
  await sender.getByRole("button", { name: "Send tokens" }).click();
  await sender.getByRole("heading", { name: "Tokens dispatched" }).waitFor();
  const sentAt = Date.now();

  const litBell = recipient.getByRole("button", { name: "Notifications, 1 unread" });
  await litBell.waitFor({ timeout: refreshWindowMs + slackMs });
  const litAfterMs = Date.now() - sentAt;

  await litBell.click();
  const panel = recipient.getByRole("region", { name: "Incoming transfers" });
  await panel.getByText("Aaron sent 250 tokens").waitFor();
  await panel.getByText(/Dust filters/).waitFor();
  await shot(recipient, "02-bell-unread-feed.png");

  await panel.getByRole("button", { name: "Mark all as read" }).click();
  await quietBell.waitFor({ timeout: 2_000 });
  const badges = await recipient.locator(".desk-bell-count").count();
  if (badges !== 0) throw new Error(`Expected no unread badge, saw ${badges}`);
  await shot(recipient, "03-bell-after-read.png");

  await recipient.reload({ waitUntil: "domcontentloaded" });
  await recipient
    .getByRole("heading", { name: /Good (morning|afternoon|evening), Ben/ })
    .waitFor({ timeout: 15_000 });
  await sleep(refreshWindowMs + 500);
  const unreadAfterReload = await recipient
    .getByRole("button", { name: /Notifications, \d+ unread/ })
    .count();
  if (unreadAfterReload !== 0) throw new Error("Read state did not survive a reload");

  const video = recipient.video();
  await recipientContext.close();
  recipientContext = undefined;
  console.log(
    JSON.stringify(
      {
        ok: true,
        sender: "aaron",
        recipient: "ben",
        litAfterMs,
        refreshWindowMs,
        readStateSurvivedReload: true,
        evidence: evidenceDir
          ? { dir: evidenceDir, video: video ? await video.path() : null }
          : null,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  console.error(log.slice(-4000));
  process.exitCode = 1;
} finally {
  if (recipientContext) await recipientContext.close().catch(() => {});
  if (senderBrowser) await senderBrowser.close().catch(() => {});
  if (recipientBrowser) await recipientBrowser.close().catch(() => {});
  stop(child);
  restoreTracked();
}

process.exit(process.exitCode ?? 0);
