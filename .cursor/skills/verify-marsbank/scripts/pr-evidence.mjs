#!/usr/bin/env node
// Publish before/after PNGs plus a GIF to the PR branch, write PR-body markdown,
// then prove the rendered PR shows every image.
//
//   pr-evidence.mjs publish --feature <slug> --before <png> --after <png> --video <webm|mp4>
//                           [--title <text>] [--append <md file>] [--out <md file>] [--no-push]
//   pr-evidence.mjs check   --pr <number> [--feature <slug>] [--logged-out-screenshot <png>]
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ensureDir, fail, launchChromium, repoRoot } from "./lib.mjs";

const GIF_LIMIT_BYTES = 5 * 1024 * 1024;
const GIF_WIDTHS = [960, 800, 640, 480];
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MEDIA = { before: "before.png", after: "after.png", gif: "demo.gif", mp4: "demo.mp4" };

function parseArgs(argv) {
  const args = { command: argv[0], push: true };
  for (let i = 1; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === "--no-push") {
      args.push = false;
      continue;
    }
    if (!key.startsWith("--")) fail(`Unexpected argument ${key}`);
    const name = key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[++i];
    if (value === undefined) fail(`${key} needs a value`);
    args[name] = value;
  }
  return args;
}

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function githubRepo() {
  const remote = run("git", ["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) fail(`origin is not a GitHub remote: ${remote.replace(/\/\/[^@]*@/, "//")}`);
  return { owner: match[1], repo: match[2] };
}

function githubToken() {
  return process.env.GH_TOKEN || process.env.GITHUB_TOKEN || run("gh", ["auth", "token"]);
}

async function api(path, accept = "application/vnd.github+json") {
  const response = await fetch(`https://api.github.com/${path}`, {
    headers: { Authorization: `Bearer ${githubToken()}`, Accept: accept },
  });
  return response;
}

function makeGif(video, gifPath) {
  for (const width of GIF_WIDTHS) {
    run("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      video,
      "-vf",
      `fps=6,scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`,
      "-loop",
      "0",
      gifPath,
    ]);
    const size = statSync(gifPath).size;
    if (size <= GIF_LIMIT_BYTES) return { width, size };
  }
  fail(`GIF is still over ${GIF_LIMIT_BYTES} bytes at ${GIF_WIDTHS.at(-1)}px wide. Trim the recording.`);
}

function makeMp4(video, mp4Path) {
  if (video.endsWith(".mp4")) {
    copyFileSync(video, mp4Path);
    return;
  }
  run("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    video,
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-vf",
    "scale=trunc(iw/2)*2:trunc(ih/2)*2",
    mp4Path,
  ]);
}

async function publish(args) {
  for (const key of ["feature", "before", "after", "video"]) {
    if (!args[key]) fail(`publish needs --${key}`);
  }
  if (!/^[a-z0-9-]+$/.test(args.feature)) fail("--feature must be kebab-case");
  for (const key of ["before", "after", "video"]) {
    if (!existsSync(args[key])) fail(`Missing --${key} file ${args[key]}`);
  }
  const branch = run("git", ["branch", "--show-current"]);
  if (!branch || branch === "main") fail("Run publish on the PR branch, not main.");

  const dir = join(repoRoot, "docs", "verification", args.feature);
  ensureDir(dir);
  const paths = Object.fromEntries(Object.entries(MEDIA).map(([key, file]) => [key, join(dir, file)]));
  copyFileSync(args.before, paths.before);
  copyFileSync(args.after, paths.after);
  makeMp4(args.video, paths.mp4);
  const gif = makeGif(paths.mp4, paths.gif);

  const relativePaths = Object.values(paths).map((path) => relative(repoRoot, path));
  run("git", ["add", "--", ...relativePaths]);
  const staged = run("git", ["diff", "--cached", "--name-only", "--", ...relativePaths]);
  if (staged) {
    run("git", ["commit", "-m", `Add PR evidence for ${args.feature}`, "--", ...relativePaths]);
  }
  if (args.push) {
    run("git", ["push", "-u", "origin", branch], { stdio: ["ignore", "pipe", "inherit"] });
  }
  const sha = run("git", ["rev-parse", "HEAD"]);
  const { owner, repo } = githubRepo();
  const url = (file) =>
    `https://github.com/${owner}/${repo}/raw/${sha}/docs/verification/${args.feature}/${file}`;
  const title = args.title ?? args.feature.replace(/-/g, " ");

  const sections = [
    `### Before`,
    "",
    `![Before: ${title}](${url(MEDIA.before)})`,
    "",
    `### After`,
    "",
    `![After: ${title}](${url(MEDIA.after)})`,
    "",
    `### In motion`,
    "",
    `![Recording: ${title}](${url(MEDIA.gif)})`,
    "",
    `[Full recording (mp4)](${url(MEDIA.mp4)})`,
  ];
  if (args.append) sections.push("", readFileSync(args.append, "utf8").trimEnd());
  const markdown = `${sections.join("\n")}\n`;
  const out = args.out ?? join(dir, "pr-body.md");
  writeFileSync(out, markdown);
  console.log(
    JSON.stringify(
      {
        ok: true,
        commit: sha,
        pushed: args.push,
        gif: { bytes: gif.size, width: gif.width },
        media: relativePaths,
        markdown: out,
      },
      null,
      2,
    ),
  );
}

const SIGNATURES = [
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
  ["image/webp", [0x52, 0x49, 0x46, 0x46]],
];

function sniffImage(bytes) {
  for (const [type, magic] of SIGNATURES) {
    if (magic.every((byte, i) => bytes[i] === byte)) return type;
  }
  return null;
}

function decodeEntities(value) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*?\ssrc="([^"]+)"/g)].map((match) => decodeEntities(match[1]));
}

// Load an image the way a logged-out browser does: no cookies, no token, every
// redirect followed. Hops are followed by hand so a failure names its host.
async function loadLikeLoggedOutBrowser(src) {
  const hops = [];
  let url = src;
  for (let i = 0; i < 10; i += 1) {
    let response;
    try {
      response = await fetch(url, { redirect: "manual", headers: { "User-Agent": BROWSER_UA } });
    } catch (error) {
      const code = error instanceof Error ? error.cause?.code ?? error.message : String(error);
      hops.push(`${new URL(url).host} ${code}`);
      return { src, ok: false, status: null, hops, error: `${new URL(url).host} unreachable (${code})` };
    }
    hops.push(`${new URL(url).host} ${response.status}`);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = sniffImage(bytes);
    return {
      src,
      ok: response.status === 200 && type !== null,
      status: response.status,
      contentType: response.headers.get("content-type"),
      type,
      bytes: bytes.length,
      hops,
    };
  }
  return { src, ok: false, status: null, hops, error: "too many redirects" };
}

async function screenshotLoggedOut(url, path) {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tab = await context.newPage();
  const response = await tab.goto(url, { waitUntil: "load" });
  await tab.waitForTimeout(2_000);
  const images = await tab.locator(".comment-body img, .markdown-body img").evaluateAll((nodes) =>
    nodes.map((img) => ({ src: img.currentSrc || img.src, rendered: img.complete && img.naturalWidth > 0 })),
  );
  await tab.screenshot({ path, fullPage: true });
  await browser.close();
  return { status: response?.status() ?? null, images };
}

async function check(args) {
  if (!args.pr) fail("check needs --pr <number>");
  const { owner, repo } = githubRepo();
  const repoResponse = await api(`repos/${owner}/${repo}`);
  if (repoResponse.status !== 200) fail(`Cannot read ${owner}/${repo}: HTTP ${repoResponse.status}`);
  const isPrivate = (await repoResponse.json()).private;

  const prResponse = await api(`repos/${owner}/${repo}/pulls/${args.pr}`, "application/vnd.github.html+json");
  if (prResponse.status !== 200) fail(`Cannot read PR #${args.pr}: HTTP ${prResponse.status}`);
  const pr = await prResponse.json();
  const bodyHtml = pr.body_html ?? "";
  const sources = imageSources(bodyHtml);

  const failures = [];
  if (sources.length === 0) failures.push("Rendered PR body has no <img> tags.");
  if (/<video\s[^>]*src=/i.test(pr.body ?? "") && !/<video\b/i.test(bodyHtml)) {
    failures.push("Body has a <video> tag that GitHub stripped. Use the GIF instead.");
  }
  if (args.feature) {
    for (const file of [MEDIA.before, MEDIA.after, MEDIA.gif]) {
      const suffix = `/docs/verification/${args.feature}/${file}`;
      if (!sources.some((src) => src.endsWith(suffix))) {
        failures.push(`Rendered PR body has no <img> for ${suffix.slice(1)}.`);
      }
    }
  }

  const results = [];
  for (const src of sources) {
    const result = await loadLikeLoggedOutBrowser(src);
    results.push(result);
    if (!result.ok) {
      failures.push(`Not a 200 image for a logged-out browser: ${src} (${result.error ?? `HTTP ${result.status}, ${result.type ?? "not image bytes"}`})`);
    }
  }

  const prUrl = `https://github.com/${owner}/${repo}/pull/${args.pr}`;
  const page = await loadLikeLoggedOutBrowser(prUrl);
  const loggedOut = { url: prUrl, status: page.status, hops: page.hops, error: page.error };
  if (page.status !== 200) failures.push(`Logged-out PR page did not load: ${page.error ?? `HTTP ${page.status}`}`);
  if (args.loggedOutScreenshot) {
    const shot = await screenshotLoggedOut(prUrl, args.loggedOutScreenshot);
    loggedOut.screenshot = { path: args.loggedOutScreenshot, ...shot };
  }

  console.log(
    JSON.stringify({ ok: failures.length === 0 && !isPrivate, pr: prUrl, repoPrivate: isPrivate, images: results, loggedOut, failures }, null, 2),
  );
  if (isPrivate) {
    fail(
      `${owner}/${repo} is private, so logged-out viewers cannot load repo images: drag and drop before.png, after.png and demo.gif into the PR description editor on github.com (user-attachments uploads work on private repos), then rerun check.`,
    );
  }
  if (failures.length > 0) process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (args.command === "publish") await publish(args);
else if (args.command === "check") await check(args);
else fail("Usage: pr-evidence.mjs publish|check [options] (see the PR evidence section of SKILL.md)");
