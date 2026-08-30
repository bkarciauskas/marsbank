import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.MEASURE_BASE ?? "http://localhost:3000";
const outDir = process.env.MEASURE_DIR ?? ".impeccable/widths";
const shotFor = process.env.MEASURE_SHOTS?.split(",").map(Number) ?? [1440, 2560];

const routes = [
  { name: "position", path: "/banking" },
  { name: "accounts", path: "/banking/accounts" },
  { name: "account-detail", path: "/banking/accounts/acc-everyday" },
  { name: "cards", path: "/banking/cards" },
  { name: "send", path: "/banking/transfer" },
  { name: "reports", path: "/banking/reports" },
  { name: "settings", path: "/banking/settings" },
  { name: "activity", path: "/banking/activity" },
  { name: "activity-search", path: "/banking/activity?q=Habitat" },
];

// 1200 and 1210 straddle the side-by-side threshold, where the support cards
// are at their narrowest while the viewport is still wide. Card-narrow forms in
// this stylesheet are keyed to viewport width, so they do not fire there.
const widths = [390, 850, 1080, 1200, 1210, 1280, 1440, 1680, 1920, 2560, 3440];

const MAX_GUTTER_SKEW = 2;
const DESKTOP_FROM = 1280;

// Narrowest numeric column in the ledger. The complaint was "cramped": an
// 11-digit grouped figure at 13px needs ~120px, so anything under this is
// flush against its own content.
const MIN_LEDGER_FIGURE_COLUMN = 150;

// A sparse row (date, description, amount) turns into a wasteland when the
// middle track stretches. The ~800px run these rows already had before the
// measure work is a row-content defect, not a width defect, so this is a
// do-no-harm ceiling: widening a register past it is the regression to catch.
const MAX_ROW_DEAD_SPAN = 850;

function measure() {
  const read = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      width: Math.round(rect.width),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      maxWidth: style.maxWidth,
      paddingInline: `${style.paddingLeft}/${style.paddingRight}`,
    };
  };

  const stage = read(".bank-stage");
  const content = read(".bank-content");
  const shell = read(".banking-shell");
  const railHidden =
    !document.querySelector(".bank-sidebar") ||
    getComputedStyle(document.querySelector(".bank-sidebar")).display === "none";

  let overflow = 0;
  for (const el of document.querySelectorAll(".bank-content *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.right > window.innerWidth + 1) overflow += 1;
  }

  const ledgerRow = document.querySelector(".account-list a");
  const figureColumns = ledgerRow
    ? [...ledgerRow.querySelectorAll(".account-value")].map((cell) =>
        Math.round(cell.getBoundingClientRect().width),
      )
    : [];

  // Widest horizontal run with no glyphs in it, across the sparse list rows.
  // Grid tracks stretch, so the emptiness sits inside a child rather than
  // between children; only the painted text extent reveals it.
  const inkSpan = (el) => {
    const range = document.createRange();
    let left = Infinity;
    let right = -Infinity;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if ((node.textContent ?? "").trim().length === 0) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width === 0) continue;
        left = Math.min(left, rect.left);
        right = Math.max(right, rect.right);
      }
    }
    return left === Infinity ? null : { left, right };
  };

  let deadSpan = 0;
  for (const row of document.querySelectorAll(".transaction-row, .desk-movements li")) {
    const spans = [...row.children]
      .map(inkSpan)
      .filter((span) => span !== null)
      .sort((a, b) => a.left - b.left);
    for (let i = 1; i < spans.length; i += 1) {
      deadSpan = Math.max(deadSpan, Math.round(spans[i].left - spans[i - 1].right));
    }
  }

  return {
    viewport: window.innerWidth,
    docScrollWidth: document.documentElement.scrollWidth,
    shell,
    stage,
    content,
    railHidden,
    overflowingChildren: overflow,
    figureColumns,
    narrowestFigureColumn: figureColumns.length > 0 ? Math.min(...figureColumns) : null,
    widestRowDeadSpan: deadSpan,
  };
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const page = await context.newPage();

await page.goto(`${base}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: "Enter Mars Bank" }).click();
await page.waitForURL("**/banking", { timeout: 30_000 });
await page.addStyleTag({
  content: "nextjs-portal, [data-nextjs-toast] { display: none !important; }",
});

const rows = [];
const failures = [];

for (const width of widths) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of routes) {
    await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".bank-content", { timeout: 15_000 });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(measure);

    const leftGutter = m.content.left - m.stage.left;
    const rightGutter = m.stage.right - m.content.right;
    const stageUse = m.content.width / m.stage.width;
    const row = {
      route: route.name,
      width,
      stage: m.stage.width,
      content: m.content.width,
      maxWidth: m.content.maxWidth,
      leftGutter,
      rightGutter,
      skew: Math.abs(leftGutter - rightGutter),
      stageUse: Number(stageUse.toFixed(3)),
      overflowingChildren: m.overflowingChildren,
      horizontalScroll: m.docScrollWidth > width + 1,
      narrowestFigureColumn: m.narrowestFigureColumn,
      widestRowDeadSpan: m.widestRowDeadSpan,
    };
    rows.push(row);

    if (width >= DESKTOP_FROM) {
      if (row.skew > MAX_GUTTER_SKEW) {
        failures.push(
          `${route.name} @${width}: content is off-centre in the stage by ${row.skew}px (left ${leftGutter} vs right ${rightGutter})`,
        );
      }
      // Only meaningful where the measure is what bounds the column. When
      // content fills the stage the viewport is the limit and no width choice
      // can buy the figures more room.
      const measureBinds = m.content.width < m.stage.width - 1;
      if (
        measureBinds &&
        m.narrowestFigureColumn !== null &&
        m.narrowestFigureColumn < MIN_LEDGER_FIGURE_COLUMN
      ) {
        failures.push(
          `${route.name} @${width}: narrowest ledger figure column is ${m.narrowestFigureColumn}px, under the ${MIN_LEDGER_FIGURE_COLUMN}px comfort floor (cramped)`,
        );
      }
      if (m.widestRowDeadSpan > MAX_ROW_DEAD_SPAN) {
        failures.push(
          `${route.name} @${width}: a sparse row has a ${m.widestRowDeadSpan}px empty run, over the ${MAX_ROW_DEAD_SPAN}px budget (stretched)`,
        );
      }
    }
    if (row.horizontalScroll) {
      failures.push(`${route.name} @${width}: document scrolls horizontally`);
    }
    if (row.overflowingChildren > 0) {
      failures.push(
        `${route.name} @${width}: ${row.overflowingChildren} element(s) overflow the viewport`,
      );
    }

    if (shotFor.includes(width)) {
      await page.screenshot({
        path: `${outDir}/${route.name}-${width}.png`,
        fullPage: false,
      });
    }
  }
}

await context.close();
await browser.close();

await writeFile(`${outDir}/measurements.json`, `${JSON.stringify(rows, null, 2)}\n`);

const header = [
  "route",
  "vw",
  "stage",
  "content",
  "max-width",
  "skew",
  "use",
  "figure",
  "dead",
];
const table = rows.map((r) => [
  r.route,
  r.width,
  r.stage,
  r.content,
  r.maxWidth,
  r.skew,
  `${(r.stageUse * 100).toFixed(0)}%`,
  r.narrowestFigureColumn ?? "-",
  r.widestRowDeadSpan,
]);
const widthsOf = header.map((h, i) =>
  Math.max(h.length, ...table.map((row) => String(row[i]).length)),
);
const render = (cells) =>
  cells.map((cell, i) => String(cell).padEnd(widthsOf[i])).join("  ");
console.log(render(header));
console.log(widthsOf.map((w) => "-".repeat(w)).join("  "));
for (const row of table) console.log(render(row));

console.log(`\n${rows.length} measurements written to ${outDir}/measurements.json`);
if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("all viewports within layout budget");
