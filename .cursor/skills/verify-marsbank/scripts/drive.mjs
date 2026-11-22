#!/usr/bin/env node
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ensureDir,
  evidenceRoot,
  fail,
  launchChromium,
  loadInstance,
  writeJson,
} from "./lib.mjs";

const FEATURES = [
  "login",
  "accounts",
  "balances",
  "transfer",
  "cards",
  "activity",
  "notifications",
  "reports",
  "settings",
];
const RECORDED = { login: "03-login-path.webm", balances: "03-balances.webm" };

const residents = {
  cameron: {
    name: /cameron/i,
    firstName: "Cameron",
    member: "MB-104821",
    email: "cameron@marsbank.mars",
    everyday: 1_000_184_220,
  },
  aaron: {
    name: /aaron/i,
    firstName: "Aaron",
    member: "MB-110274",
    email: "aaron@marsbank.mars",
    everyday: 1_000_096_410,
  },
};

function expectedGreeting(firstName, hour) {
  const daypart = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
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
  const radio = page.getByRole("radio", { name: resident.name });
  await page.locator("label").filter({ has: radio }).click();
  await expectVisible(radio);
  if (!(await radio.isChecked())) {
    throw new Error(`${residentKey} radio was not checked after clicking its label`);
  }
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
  const idValue = await page.locator("#mars-bank-id").inputValue();
  if (idValue !== resident.email) {
    throw new Error(`Mars Bank ID was ${idValue}, expected ${resident.email}`);
  }
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking", { timeout: 15_000 });
  const observedGreeting = await waitForViewerGreeting(page, resident.firstName);
  await page.getByText(new RegExp(`Client ${resident.member}`)).waitFor();
  const after = await capture(page, dir, "02-banking-home");
  const register = await writeRegister(page, dir);
  const email = register.body?.snapshot?.customer?.email;
  if (register.status !== 200 || email !== resident.email) {
    throw new Error(`Register after login did not belong to ${resident.email}: ${JSON.stringify(register)}`);
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
  await page.getByRole("link", { name: "Open habitat loan" }).click();
  await page.waitForURL("**/banking/accounts/acc-habitat-loan");
  const loanHeading = await page.getByRole("heading", { level: 1 }).innerText();
  const figureLabel = await page.locator(".desk-position span").first().innerText();
  if (figureLabel !== "Remaining") {
    throw new Error(`Habitat loan figure was ${figureLabel}`);
  }
  await page.getByRole("region", { name: "Offset planner" }).waitFor();
  const repayHref = await page.getByRole("link", { name: "Make a repayment" }).getAttribute("href");
  if (repayHref !== "/banking/transfer?from=acc-everyday&to=acc-habitat-loan") {
    throw new Error(`Make a repayment pointed at ${repayHref}`);
  }
  await page.getByLabel("Lump-sum payment").fill("10000");
  const amountHref = await page
    .getByRole("link", { name: "Repay 10,000 tokens" })
    .getAttribute("href");
  if (amountHref !== "/banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=10000") {
    throw new Error(`Repay link pointed at ${amountHref}`);
  }
  await page.getByLabel("Move into offset").fill("12.5");
  await page.getByText("Enter whole tokens, such as 250,000.").waitFor();
  const plannerShot = await capture(page, dir, "03-offset-planner");
  return {
    actions: [
      "login via demo roster",
      'sidebar link "Accounts"',
      'open link "Sol Account"',
      "open the habitat loan",
      'fill "Lump-sum payment" 10000',
      'fill "Move into offset" 12.5',
    ],
    observed: {
      registerUrl: `${baseUrl}/banking/accounts`,
      detailUrl: `${baseUrl}/banking/accounts/acc-everyday`,
      registerHeading: "Token register",
      accountHeading: "Sol Account",
      loanHeading,
      figureLabel,
      repayHref,
      amountHref,
    },
    artifacts: [registerShot, detailShot, plannerShot],
  };
}

async function driveBalances(page, baseUrl, dir, residentKey) {
  const pause = () => page.waitForTimeout(1_200);
  await loginThroughRoster(page, baseUrl, residentKey);
  await pause();
  await page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Accounts" }).click();
  await page.waitForURL("**/banking/accounts");
  await page.getByRole("heading", { level: 1, name: "Token register" }).waitFor();
  const firstFigure = page.locator(".account-value strong").first();
  const shownText = await firstFigure.innerText();
  if (!/\d/.test(shownText)) throw new Error(`Expected a balance before hiding, saw ${shownText}`);
  await page.getByRole("button", { name: "Show register position" }).click();
  const position = page.locator("#register-position");
  await position.getByRole("heading", { name: "Register position" }).waitFor();
  const positionShown = await position.innerText();
  if (!/\d/.test(positionShown)) {
    throw new Error(`Register position had no figure before hiding, saw ${positionShown}`);
  }
  await pause();
  const shown = await capture(page, dir, "01-balances-shown");
  const hideButton = page.getByRole("button", { name: "Hide balances" });
  await hideButton.click();
  const showButton = page.getByRole("button", { name: "Show balances" });
  await showButton.waitFor();
  if ((await showButton.getAttribute("aria-pressed")) !== "true") {
    throw new Error("Show balances was not pressed after Hide balances");
  }
  const figures = await page.locator(".account-value strong").allInnerTexts();
  if (figures.length === 0 || figures.some((text) => /\d/.test(text))) {
    throw new Error(`Balances still visible after Hide balances: ${figures.join(" | ")}`);
  }
  const positionHidden = await position.innerText();
  if (/\d/.test(positionHidden)) {
    throw new Error(`Register position still showed a figure: ${positionHidden}`);
  }
  await page.getByRole("heading", { level: 1, name: "Token register" }).waitFor();
  await pause();
  const hidden = await capture(page, dir, "02-balances-hidden");
  await showButton.click();
  await page.getByRole("button", { name: "Hide balances" }).waitFor();
  const restoredText = await firstFigure.innerText();
  if (!/\d/.test(restoredText)) {
    throw new Error(`Balance did not return after Show balances, saw ${restoredText}`);
  }
  await pause();
  return {
    actions: [
      "login via demo roster",
      'sidebar link "Accounts"',
      'button "Show register position"',
      'button "Hide balances"',
      'button "Show balances"',
    ],
    observed: {
      heading: "Token register",
      firstFigureBefore: shownText,
      figuresAfter: figures,
      positionHidden,
      firstFigureRestored: restoredText,
    },
    artifacts: [shown, hidden],
  };
}

async function driveTransfer(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.goto(
    `${baseUrl}/banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=10000`,
  );
  await page.getByRole("heading", { level: 1, name: "Send tokens" }).waitFor();
  const ownPressed = await page
    .getByRole("button", { name: "Between my accounts" })
    .getAttribute("aria-pressed");
  const prefilled = await page.getByPlaceholder("0").inputValue();
  if (ownPressed !== "true" || prefilled !== "10000") {
    throw new Error(`Prefill was pressed=${ownPressed} amount=${prefilled}`);
  }
  await page.goto(`${baseUrl}/banking/transfer`);
  await page.getByPlaceholder("@name or name@domain").fill(`@${residentKey}`);
  await page.getByPlaceholder("0").fill("1000");
  await page.getByRole("button", { name: "Review route" }).click();
  await page.getByText("That identity points back to your own Mars Bank profile.").waitFor();
  await page.getByPlaceholder("@name or name@domain").fill("@cursor");
  await page.getByPlaceholder("0").fill("2000000000");
  await page.getByRole("button", { name: "Review route" }).click();
  await page.getByText("Lower the amount to fit the available token balance.").waitFor();
  await page.getByPlaceholder("0").fill("300000");
  await page.getByRole("button", { name: "Review route" }).click();
  await page.getByText("That send passes your 250,000 tokens PayID limit for this sol.").waitFor();
  await page.getByPlaceholder("0").fill("60000");
  await page.getByRole("button", { name: "Review route" }).click();
  await page.getByRole("checkbox", { name: /I confirm sending 60,000 tokens to Cursor/ }).waitFor();
  if (await page.getByRole("button", { name: "Send tokens" }).isEnabled()) {
    throw new Error("Send tokens was enabled before the step-up checkbox");
  }
  const before = await writeRegister(page, dir, "01-register-before.json");
  await page.goto(`${baseUrl}/banking`);
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
      "open /banking/transfer?from=acc-everyday&to=acc-habitat-loan&amount=10000",
      `review own PayID @${residentKey}, over-available 2000000000, sol-limit 300000, step-up 60000 without sending`,
      'link "Make a transfer"',
      'button "Between my accounts"',
      "fill 10000 tokens + Verification repayment",
      'button "Review route" then "Send tokens"',
    ],
    observed: {
      prefilledAmount: "10000",
      ownPayIdBlocked: true,
      overAvailableBlocked: true,
      solLimitBlocked: true,
      stepUpSendDisabled: true,
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
  const firstCard = page.locator("article.card-panel").first();
  const before = await capture(page, dir, "01-active");
  await firstCard.getByRole("button", { name: "Freeze card", exact: true }).click();
  await firstCard.getByRole("button", { name: "Unfreeze card", exact: true }).waitFor();
  await firstCard.getByText("Frozen", { exact: true }).waitFor();
  const frozen = await capture(page, dir, "02-frozen");
  const register = await writeRegister(page, dir);
  const frozenCard = register.body?.snapshot?.cards?.find((card) => card.status === "frozen");
  if (!frozenCard) {
    throw new Error("Register after freeze had no frozen card");
  }
  await firstCard.getByRole("button", { name: "Unfreeze card", exact: true }).click();
  await firstCard.getByRole("button", { name: "Freeze card", exact: true }).waitFor();
  await firstCard.getByText("Active", { exact: true }).waitFor();
  const restored = await writeRegister(page, dir, "register-after-unfreeze.json");
  const restoredCard = restored.body?.snapshot?.cards?.find((card) => card.id === frozenCard.id);
  if (restoredCard?.status !== "active") {
    throw new Error(`Card ${frozenCard.id} did not return to active`);
  }
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
      restoredStatus: restoredCard.status,
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
  await page.goto(`${baseUrl}/banking/activity?q=phobos%20shipyard`);
  await page.getByText("0 matching movements").waitFor();
  await page.getByText("No movement on this account").waitFor();
  if (await page.getByRole("button", { name: "Download CSV" }).isEnabled()) {
    throw new Error("Download CSV was enabled when no rows matched");
  }
  const empty = await capture(page, dir, "03-empty");
  await page.goto(`${baseUrl}/banking/activity?q=Areology%20Coffee`);
  await page.getByRole("heading", { level: 2, name: /Areology Coffee/ }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const download = await downloadPromise;
  const filename = download.suggestedFilename();
  const expectedName = "mars-bank-statement-2026-08-07-to-2026-08-25.csv";
  if (filename !== expectedName) {
    throw new Error(`Statement filename was ${filename}`);
  }
  const csvPath = join(dir, filename);
  await download.saveAs(csvPath);
  const csv = readFileSync(csvPath, "utf8");
  for (const id of ["txn-001", "txn-018", "txn-022"]) {
    if (!csv.includes(id)) throw new Error(`Statement missing ${id}`);
  }
  if (csv.includes("txn-002")) throw new Error("Statement included txn-002");
  return {
    actions: [
      "login via demo roster",
      'searchbox "Search transactions, accounts and payees" = Areology Coffee',
      "submit desk search form",
      'link "Clear search"',
      "open /banking/activity?q=phobos%20shipyard",
      'button "Download CSV" on Areology Coffee',
    ],
    observed: {
      resultHeading: "Results for “Areology Coffee”",
      matchingRows: count,
      clearedHeading: "Posted by sol",
      emptyCsvDisabled: true,
      statementFilename: filename,
    },
    artifacts: [results, cleared, empty, { csvPath }],
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

async function driveNotifications(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.getByRole("button", { name: "Notifications", exact: true }).click();
  const panel = page.getByRole("region", { name: "Incoming transfers" });
  await panel.getByRole("heading", { level: 2, name: "Incoming transfers" }).waitFor();
  await panel.getByText("No tokens from other residents yet.").waitFor();
  const markRead = panel.getByRole("button", { name: "Mark all as read" });
  if (await markRead.isEnabled()) {
    throw new Error("Mark all as read was enabled on an empty bell");
  }
  const open = await capture(page, dir, "01-bell-open");
  const requesterKey = residentKey === "aaron" ? "cameron" : "aaron";
  const requester = residents[requesterKey];
  const payer = residents[residentKey];
  const other = await page.context().browser().newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const requesterPage = await other.newPage();
    await loginThroughRoster(requesterPage, baseUrl, requesterKey);
    await requesterPage
      .getByRole("navigation", { name: "Banking" })
      .getByRole("link", { name: "Send" })
      .click();
    await requesterPage.getByRole("button", { name: "Request tokens" }).click();
    await requesterPage
      .getByPlaceholder("@resident or resident@marsbank.mars")
      .fill(`@${residentKey}`);
    await requesterPage.getByPlaceholder("0").fill("60000");
    await requesterPage.getByRole("button", { name: "Send request" }).click();
    await requesterPage
      .getByRole("status")
      .filter({ hasText: `Requested 60,000 tokens from ${payer.firstName}` })
      .waitFor();
    await page.getByRole("button", { name: "Notifications, 1 unread" }).waitFor({ timeout: 12_000 });
    if (await markRead.isEnabled()) {
      throw new Error("Mark all as read was enabled for an open request with no unread credit");
    }
    await panel.getByText(`${requester.firstName} requested 60,000 tokens`).waitFor();
    await panel.getByRole("button", { name: "Approve" }).click();
    await panel
      .getByRole("checkbox", {
        name: new RegExp(`I confirm sending 60,000 tokens to ${requester.firstName}`),
      })
      .waitFor();
    if (await panel.getByRole("button", { name: "Confirm payment" }).isEnabled()) {
      throw new Error("Confirm payment was enabled before the checkbox");
    }
    const requestShot = await capture(page, dir, "02-request");
    await panel.getByRole("button", { name: "Cancel" }).click();
    await panel.getByRole("button", { name: "Decline" }).click();
    await panel.getByText("No tokens from other residents yet.").waitFor();
    await page.getByRole("button", { name: "Notifications", exact: true }).waitFor();
    return {
      actions: [
        "login via demo roster",
        'button "Notifications"',
        `${requesterKey} requests 60000 tokens`,
        "approve shows the confirmation checkbox",
        "cancel, then decline",
      ],
      observed: {
        heading: "Incoming transfers",
        empty: "No tokens from other residents yet.",
        badgeWithRequest: "Notifications, 1 unread",
        markReadStaysDisabled: true,
        confirmPaymentDisabled: true,
      },
      artifacts: [open, requestShot],
    };
  } finally {
    await other.close();
  }
}

async function driveReports(page, baseUrl, dir, residentKey) {
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.getByRole("navigation", { name: "Banking" }).getByRole("link", { name: "Reports" }).click();
  await page.waitForURL("**/banking/reports");
  await page.getByRole("heading", { level: 1, name: "Posted movement" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Flow totals" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Spend by habit" }).waitFor();
  await page.getByRole("heading", { level: 2, name: "Spend by account" }).waitFor();
  const report = await capture(page, dir, "01-posted-movement");
  await page.getByRole("link", { name: "Open full ledger" }).click();
  await page.waitForURL("**/banking/activity");
  await page.getByRole("heading", { level: 1, name: "Token movement" }).waitFor();
  const ledger = await capture(page, dir, "02-full-ledger");
  return {
    actions: [
      "login via demo roster",
      'sidebar link "Reports"',
      'link "Open full ledger"',
    ],
    observed: {
      heading: "Posted movement",
      ledgerUrl: page.url(),
    },
    artifacts: [report, ledger],
  };
}

async function driveSettings(page, baseUrl, dir, residentKey) {
  const resident = residents[residentKey];
  await loginThroughRoster(page, baseUrl, residentKey);
  await page.locator("a.desk-customer").click();
  await page.waitForURL("**/banking/settings");
  await page.getByRole("heading", { level: 1, name: "Settings" }).waitFor();
  await page.getByText(resident.email).waitFor();
  await page.getByText(resident.member).waitFor();
  const profile = await capture(page, dir, "01-settings");
  await page.getByRole("button", { name: "Restore shared demo" }).click();
  await page.getByRole("button", { name: "Restore all registers" }).click();
  await page.getByText("All six registers restored.").waitFor();
  const restored = await capture(page, dir, "02-restored");
  const register = await writeRegister(page, dir);
  const everyday = everydayAvailable(register.body);
  if (everyday !== resident.everyday) {
    throw new Error(`Sol Account after restore was ${everyday}, expected ${resident.everyday}`);
  }
  return {
    actions: [
      "login via demo roster",
      "open the resident name",
      'button "Restore shared demo"',
      'button "Restore all registers"',
    ],
    observed: {
      email: resident.email,
      memberId: resident.member,
      everyday,
    },
    artifacts: [profile, restored],
  };
}

const drivers = {
  login: driveLogin,
  accounts: driveAccounts,
  balances: driveBalances,
  transfer: driveTransfer,
  cards: driveCards,
  activity: driveActivity,
  notifications: driveNotifications,
  reports: driveReports,
  settings: driveSettings,
};

const args = parseArgs(process.argv.slice(2));
const instance = loadInstance();
if (!instance) {
  fail("Drive: no instance file. Launch with scripts/launch.mjs and pass scripts/doctor.mjs first.");
}

const dir = join(evidenceRoot, instance.runId, args.feature);
ensureDir(dir);

const browser = await launchChromium({ headless: !args.headed });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
  baseURL: instance.baseUrl,
  ...(RECORDED[args.feature] ? { recordVideo: { dir, size: { width: 1440, height: 900 } } } : {}),
});
const page = await context.newPage();
const videoPath = RECORDED[args.feature] ? join(dir, RECORDED[args.feature]) : null;

let result;
let driveError;
try {
  result = await drivers[args.feature](page, instance.baseUrl, dir, args.resident);
} catch (error) {
  await capture(page, dir, "failure").catch(() => undefined);
  driveError = error;
} finally {
  const video = videoPath ? page.video() : null;
  await context.close();
  if (video) {
    renameSync(await video.path(), videoPath);
  }
  await browser.close();
}

if (driveError) {
  fail(`Drive ${args.feature} failed: ${driveError instanceof Error ? driveError.stack ?? driveError.message : driveError}`);
}

if (videoPath) {
  result.artifacts.push({ videoPath });
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
