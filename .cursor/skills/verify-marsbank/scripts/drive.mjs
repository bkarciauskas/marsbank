#!/usr/bin/env node
import { renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  ensureDir,
  evidenceRoot,
  fail,
  loadInstance,
  writeJson,
} from "./lib.mjs";

const FEATURES = ["login", "accounts", "transfer", "cards", "activity"];

const residents = {
  cameron: { name: /cameron/i, firstName: "Cameron", member: "MB-104821" },
  aaron: { name: /aaron/i, firstName: "Aaron", member: "MB-110274" },
};

function expectedGreeting(firstName, hour) {
  const daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  return `Good ${daypart}, ${firstName}`;
}

function parseArgs(argv) {
  const args = { feature: "login", resident: "aaron", headed: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--headed") args.headed = true;
    else if (value === "--resident") args.resident = argv[++i];
    else if (value === "--feature") args.feature = argv[++i];
    else positional.push(value);
  }
  if (positional[0]) args.feature = positional[0];
  if (!FEATURES.includes(args.feature)) {
    fail(`Unknown feature "${args.feature}". Use one of: ${FEATURES.join(", ")}`);
  }
  if (!residents[args.resident]) {
    fail(`Unknown resident "${args.resident}". Use cameron or aaron.`);
  }
  return args;
}

async function capture(page, dir, stem) {
  ensureDir(dir);
  const screenshotPath = join(dir, `${stem}.png`);
  const ariaPath = join(dir, `${stem}.aria.txt`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const aria = await page.locator("body").ariaSnapshot();
  writeFileSync(ariaPath, `${aria}\n`);
  return { screenshotPath, ariaPath };
}

async function selectResident(page, residentKey) {
  const resident = residents[residentKey];
  await page
    .locator("label")
    .filter({ has: page.getByRole("radio", { name: resident.name }) })
    .click();
  await expectVisible(page.getByRole("radio", { name: resident.name }));
}

async function waitForViewerGreeting(page, firstName) {
  for (;;) {
    const hour = await page.evaluate(() => new Date().getHours());
    const heading = expectedGreeting(firstName, hour);
    try {
      await page
        .getByRole("heading", { level: 1, name: heading })
        .waitFor({ timeout: 1_000 });
      return { hour, heading };
    } catch {
      const currentHour = await page.evaluate(() => new Date().getHours());
      if (currentHour === hour) throw new Error("Local greeting did not render");
    }
  }
}

async function loginThroughRoster(page, baseUrl, residentKey) {
  const resident = residents[residentKey];
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  await selectResident(page, residentKey);
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking", { timeout: 15_000 });
  await waitForViewerGreeting(page, resident.firstName);
}

async function writeRegister(page, dir, name = "register.json") {
  const response = await page.request.get("/api/register");
  const body = await response.json();
  writeJson(join(dir, name), { status: response.status(), body });
  return { status: response.status(), body };
}

async function driveLogin(page, baseUrl, dir, residentKey) {
  const resident = residents[residentKey];
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle" });
  const before = await capture(page, dir, "01-login-form");
  await selectResident(page, residentKey);
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking", { timeout: 15_000 });
  const observedGreeting = await waitForViewerGreeting(page, resident.firstName);
  await page.getByText(new RegExp(`Client ${resident.member}`)).waitFor();
  const after = await capture(page, dir, "02-banking-home");
  const register = await writeRegister(page, dir);
  const email = register.body?.snapshot?.customer?.email;
  if (register.status !== 200 || !String(email).includes(residentKey)) {
    throw new Error(`Register after login did not belong to ${residentKey}: ${JSON.stringify(register)}`);
  }
  return {
    actions: [
      `GET ${baseUrl}/login`,
      `click ${residentKey} roster label`,
      'click button "Enter Mars Bank"',
      "land on /banking",
    ],
    observed: {
      url: page.url(),
      heading: observedGreeting.heading,
      hour: observedGreeting.hour,
      memberId: resident.member,
      registerEmail: email,
    },
    artifacts: [before, after],
  };
}

async function driveAccounts(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Accounts" }).click();
  await page.waitForURL("**/banking/accounts");
  await page.getByRole("heading", { level: 1, name: "Token register" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Offset accounts" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Habitat debt and expedition credit" }).waitFor();
  const registerShot = await capture(page, dir, "01-token-register");
  await page.getByRole("link", { name: /Sol Account/i }).first().click();
  await page.waitForURL("**/banking/accounts/acc-everyday");
  await page.getByRole("heading", { level: 1, name: "Sol Account" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Account movement" }).waitFor();
  const detailShot = await capture(page, dir, "02-sol-account");
  return {
    actions: [
      "login via demo roster",
      'sidebar link "Accounts"',
      'open link "Sol Account"',
    ],
    observed: {
      registerUrl: `${baseUrl}/banking/accounts`,
      detailUrl: page.url(),
      registerHeading: "Token register",
      accountHeading: "Sol Account",
    },
    artifacts: [registerShot, detailShot],
  };
}

async function driveTransfer(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  const before = await writeRegister(page, dir, "01-register-before.json");
  await page.getByRole("link", { name: /Make a transfer/i }).click();
  await page.waitForURL("**/banking/transfer");
  await page.getByRole("heading", { level: 1, name: "Send tokens" }).waitFor();
  await page.getByRole("button", { name: "Between my accounts" }).click();
  await page.getByPlaceholder("0").fill("10000");
  await page.getByPlaceholder("Optional note").fill("Verification repayment");
  await page.getByRole("button", { name: "Review route" }).click();
  await page.getByText("10,000 tokens").waitFor();
  const review = await capture(page, dir, "01-review");
  await page.getByRole("button", { name: "Send tokens" }).click();
  await page.getByRole("heading", { level: 2, name: "Tokens dispatched" }).waitFor();
  const posted = await capture(page, dir, "02-dispatched");
  const after = await writeRegister(page, dir, "02-register-after.json");
  const beforeEveryday = everydayAvailable(before.body);
  const afterEveryday = everydayAvailable(after.body);
  if (afterEveryday !== beforeEveryday - 10_000) {
    throw new Error(
      `Sol Account available did not drop by 10000 (before ${beforeEveryday}, after ${afterEveryday})`,
    );
  }
  return {
    actions: [
      "login via demo roster",
      'link "Make a transfer"',
      'button "Between my accounts"',
      "fill 10000 tokens + Verification repayment",
      'button "Review route" then "Send tokens"',
    ],
    observed: {
      success: "Tokens dispatched",
      beforeEveryday,
      afterEveryday,
    },
    artifacts: [review, posted],
  };
}

async function driveCards(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Cards" }).click();
  await page.waitForURL("**/banking/cards");
  await page.getByRole("heading", { level: 1, name: "Cards for every airlock" }).waitFor();
  const before = await capture(page, dir, "01-active");
  await page.getByRole("button", { name: "Freeze card" }).first().click();
  await page.getByRole("button", { name: "Unfreeze card" }).first().waitFor();
  await page.getByText("Frozen", { exact: true }).first().waitFor();
  const frozen = await capture(page, dir, "02-frozen");
  const register = await writeRegister(page, dir);
  const frozenCard = register.body?.snapshot?.cards?.find((card) => card.status === "frozen");
  if (!frozenCard) {
    throw new Error("Register after freeze had no frozen card");
  }
  await page.getByRole("button", { name: "Unfreeze card" }).first().click();
  await page.getByRole("button", { name: "Freeze card" }).first().waitFor();
  return {
    actions: [
      "login via demo roster",
      'sidebar link "Cards"',
      'button "Freeze card" on the first card',
      'button "Unfreeze card" to restore',
    ],
    observed: {
      heading: "Cards for every airlock",
      frozenCardId: frozenCard.id,
      frozenLast4: frozenCard.last4,
    },
    artifacts: [before, frozen],
  };
}

async function driveActivity(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.getByRole("searchbox", { name: "Search transactions, accounts and payees" }).fill("Areology Coffee");
  await page.locator("form.desk-search").evaluate((form) => form.requestSubmit());
  await page.waitForURL("**/banking/activity?q=Areology%20Coffee");
  await page.getByRole("heading", { level: 1, name: "Token movement" }).waitFor();
  await page.getByRole("heading", { level: 2, name: /Results for “Areology Coffee”/ }).waitFor();
  const results = await capture(page, dir, "01-search-results");
  const rows = page.locator(".transaction-row");
  const count = await rows.count();
  if (count < 1) throw new Error("Expected matching Areology Coffee rows");
  for (let i = 0; i < count; i += 1) {
    const text = await rows.nth(i).innerText();
    if (!/areology coffee/i.test(text)) {
      throw new Error(`Row did not match search: ${text}`);
    }
  }
  await page.getByRole("link", { name: /Clear search/i }).click();
  await page.waitForURL("**/banking/activity");
  await page.getByRole("heading", { level: 2, name: "Posted by sol" }).waitFor();
  const cleared = await capture(page, dir, "02-full-ledger");
  return {
    actions: [
      "login via demo roster",
      'searchbox "Search transactions, accounts and payees" = Areology Coffee',
      "submit desk search form",
      'link "Clear search"',
    ],
    observed: {
      resultHeading: "Results for “Areology Coffee”",
      matchingRows: count,
      clearedHeading: "Posted by sol",
    },
    artifacts: [results, cleared],
  };
}

function everydayAvailable(payload) {
  const accounts = payload?.snapshot?.accounts ?? [];
  const everyday = accounts.find((account) => account.id === "acc-everyday");
  return everyday?.available;
}

async function expectVisible(locator) {
  if (!(await locator.isVisible())) {
    throw new Error("Expected control to be visible");
  }
}

const drivers = {
  login: driveLogin,
  accounts: driveAccounts,
  transfer: driveTransfer,
  cards: driveCards,
  activity: driveActivity,
};

const args = parseArgs(process.argv.slice(2));
const instance = loadInstance();
if (!instance) {
  fail("Drive: no instance file. Launch with scripts/launch.mjs and pass scripts/doctor.mjs first.");
}

const dir = join(evidenceRoot, instance.runId, args.feature);
ensureDir(dir);

const browser = await chromium.launch({ headless: !args.headed });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  baseURL: instance.baseUrl,
  ...(args.feature === "login" ? { recordVideo: { dir } } : {}),
});
const page = await context.newPage();
const loginVideoPath = join(dir, "03-login-path.webm");

let result;
let driveError;
try {
  result = await drivers[args.feature](page, instance.baseUrl, dir, args.resident);
} catch (error) {
  await capture(page, dir, "failure").catch(() => undefined);
  driveError = error;
} finally {
  const video = args.feature === "login" ? page.video() : null;
  await context.close();
  if (video) {
    renameSync(await video.path(), loginVideoPath);
  }
  await browser.close();
}

if (driveError) {
  fail(`Drive ${args.feature} failed: ${driveError instanceof Error ? driveError.stack ?? driveError.message : driveError}`);
}

if (args.feature === "login") {
  result.artifacts.push({ videoPath: loginVideoPath });
}

const proof = {
  feature: args.feature,
  runId: instance.runId,
  baseUrl: instance.baseUrl,
  resident: args.resident,
  startedFrom: "scripts/drive.mjs",
  ...result,
};
writeJson(join(dir, "proof.json"), proof);
console.log(JSON.stringify({ ok: true, evidenceDir: dir, proof }, null, 2));
