import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.CAPTURE_BASE ?? "http://localhost:3000";
const outDir = process.env.CAPTURE_DIR ?? ".impeccable/review";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  // Capping review at 1440 hid a left-pinned fixed-width stage on large
  // displays. Wide shots keep the centred measure under visual review.
  { name: "wide", width: 1920, height: 1080 },
  { name: "ultrawide", width: 2560, height: 1200 },
  { name: "mobile", width: 390, height: 844 },
  // Matches the approved comp's own pixel dimensions so the hero can be
  // compared against it without rescaling.
  { name: "hero-repro", width: 1536, height: 1024, heroOnly: true, scale: 1 },
];

const routes = [
  { slug: "", path: "/banking" },
  { slug: "-accounts", path: "/banking/accounts" },
  { slug: "-search", path: "/banking/activity?q=Habitat" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.scale ?? 2,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Enter Mars Bank" }).click();
  await page.waitForURL("**/banking", { timeout: 15_000 });

  for (const route of viewport.heroOnly ? routes.slice(0, 1) : routes) {
    await page.goto(`${base}${route.path}`, { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `${outDir}/${viewport.name}${route.slug}.png`,
      fullPage: route.slug === "" && !viewport.heroOnly,
    });
  }

  await context.close();
}

// Motion proof: the same first viewport with animation allowed, sampled mid-settle.
const motionContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: "no-preference",
});
const motionPage = await motionContext.newPage();
await motionPage.goto(`${base}/login`, { waitUntil: "networkidle" });
await motionPage.getByRole("button", { name: "Enter Mars Bank" }).click();
await motionPage.waitForURL("**/banking", { timeout: 15_000 });

// Pausing every running animation at a fixed time makes the frame deterministic
// rather than a race against the screenshot.
for (const offset of [60, 160]) {
  await motionPage.goto(`${base}/banking`, { waitUntil: "commit" });
  await motionPage.addStyleTag({
    content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }",
  });
  await motionPage.waitForSelector(".desk-card");
  await motionPage.evaluate((time) => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = time;
    }
  }, offset);
  await motionPage.screenshot({ path: `${outDir}/motion-${offset}ms.png` });
}

await motionContext.close();
await browser.close();
console.log("captured");
