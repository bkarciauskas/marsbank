#!/usr/bin/env node
// Publish before/after PNGs plus a GIF to the PR branch, write PR-body markdown,
// then prove the rendered PR shows every image.
//
//   pr-evidence.mjs publish --feature <slug> --before <png> --after <png> --video <webm|mp4>
//                           [--title <text>] [--append <md file>] [--out <md file>] [--no-push]
//   pr-evidence.mjs check   --pr <number> [--feature <slug>] [--screenshot <png>]
//                           [--logged-out-screenshot <png>] [--allow-unreachable-host <host>]...
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ensureDir, fail, launchChromium, repoRoot } from "./lib.mjs";

const GIF_LIMIT_BYTES = 5 * 1024 * 1024;
const GIF_WIDTHS = [960, 800, 640, 480];
const MEDIA = { before: "before.png", after: "after.png", gif: "demo.gif", mp4: "demo.mp4" };

function parseArgs(argv) {
  const args = { command: argv[0], allowUnreachableHost: [], push: true };
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
    if (Array.isArray(args[name])) args[name].push(value);
    else args[name] = value;
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

function repoMediaPath(src, owner, repo) {
  const match = src.match(
    new RegExp(`^https://github\\.com/${owner}/${repo}/(?:raw|blob)/([0-9a-f]{40}|[^/]+)/(.+?)(?:\\?raw=true)?$`),
  );
  return match ? { ref: match[1], path: match[2] } : null;
}

async function verifyImage(src, { owner, repo, isPrivate, allowUnreachable }) {
  const media = repoMediaPath(src, owner, repo);
  try {
    const anonymous = await fetch(src, { redirect: "follow" });
    const bytes = new Uint8Array(await anonymous.arrayBuffer());
    const type = sniffImage(bytes);
    if (anonymous.status === 200 && type) {
      return { src, ok: true, status: 200, type, bytes: bytes.length, via: "anonymous fetch" };
    }
    if (!(media && isPrivate)) {
      return { src, ok: false, status: anonymous.status, type, via: "anonymous fetch" };
    }
  } catch (error) {
    if (!media) {
      const host = new URL(src).host;
      const allowed = allowUnreachable.includes(host);
      return {
        src,
        ok: allowed,
        status: null,
        via: allowed ? "skipped: host unreachable from this machine (allowed by flag)" : "anonymous fetch",
        error: error instanceof Error ? error.cause?.code ?? error.message : String(error),
      };
    }
  }
  // A private repo serves github.com/<repo>/raw/... only to a signed-in viewer's
  // browser, which GitHub redirects to a short-lived raw URL. The contents API at
  // the same ref and path returns those exact bytes for a token with read access.
  const response = await api(
    `repos/${owner}/${repo}/contents/${media.path}?ref=${media.ref}`,
    "application/vnd.github.raw",
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = sniffImage(bytes);
  return {
    src,
    ok: response.status === 200 && type !== null,
    status: response.status,
    type,
    bytes: bytes.length,
    via: "contents API (private repo; signed-in viewers get these bytes)",
  };
}

async function screenshotRendered(bodyHtml, images, title, path) {
  let html = bodyHtml;
  for (const image of images) {
    const media = image.dataUrl;
    if (media) html = html.split(`src="${image.htmlSrc}"`).join(`src="${media}"`);
  }
  const page = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1f2328}
    .bar{background:#f6f8fa;border-bottom:1px solid #d1d9e0;padding:16px 32px;font-size:20px}
    .bar small{display:block;color:#59636e;font-size:12px}
    .box{margin:24px 32px;border:1px solid #d1d9e0;border-radius:6px}
    .box>header{background:#f6f8fa;border-bottom:1px solid #d1d9e0;padding:8px 16px;color:#59636e}
    .markdown-body{padding:16px 24px}
    .markdown-body img{max-width:100%;border:1px solid #d1d9e0}
    pre{background:#f6f8fa;padding:12px;border-radius:6px;overflow:auto;font-size:12px}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    h2,h3{border-bottom:1px solid #d1d9e0;padding-bottom:.3em}
  </style><div class="bar">${title.replace(/</g, "&lt;")}<small>body_html from the GitHub API (application/vnd.github.html+json), images loaded as a signed-in viewer</small></div>
  <div class="box"><header>Pull request description</header><div class="markdown-body">${html}</div></div>`;
  const browser = await launchChromium();
  const tab = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await tab.setContent(page, { waitUntil: "load" });
  await tab.screenshot({ path, fullPage: true });
  await browser.close();
}

async function screenshotLoggedOut(url, path) {
  const browser = await launchChromium();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const tab = await context.newPage();
  const response = await tab.goto(url, { waitUntil: "domcontentloaded" });
  await tab.waitForTimeout(1_500);
  await tab.screenshot({ path, fullPage: false });
  await browser.close();
  return response?.status() ?? null;
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
  if (/<video\b/.test(pr.body ?? "") && !/<video\b/.test(bodyHtml)) {
    failures.push("Body has a <video> tag that GitHub stripped. Use the GIF instead.");
  }

  const results = [];
  for (const src of sources) {
    const result = await verifyImage(src, {
      owner,
      repo,
      isPrivate,
      allowUnreachable: args.allowUnreachableHost,
    });
    results.push(result);
    if (!result.ok) failures.push(`Image did not resolve to a 200 image: ${src} (${result.status ?? result.error})`);
  }

  if (args.feature) {
    for (const file of [MEDIA.before, MEDIA.after, MEDIA.gif]) {
      const suffix = `/docs/verification/${args.feature}/${file}`;
      if (!sources.some((src) => src.endsWith(suffix))) {
        failures.push(`Rendered PR body has no <img> for ${suffix.slice(1)}.`);
      }
    }
  }

  const prUrl = `https://github.com/${owner}/${repo}/pull/${args.pr}`;
  let loggedOut;
  try {
    const anonymous = await fetch(prUrl, { redirect: "manual" });
    loggedOut = {
      url: prUrl,
      status: anonymous.status,
      note:
        anonymous.status === 200
          ? "Logged-out visitors can open the PR."
          : isPrivate
            ? "Private repo: logged-out visitors get a 404. Viewers must be signed in with access."
            : "Logged-out fetch did not return the PR page.",
    };
    if (args.loggedOutScreenshot) {
      loggedOut.screenshot = args.loggedOutScreenshot;
      loggedOut.browserStatus = await screenshotLoggedOut(prUrl, args.loggedOutScreenshot);
    }
  } catch (error) {
    loggedOut = { url: prUrl, error: error instanceof Error ? error.message : String(error) };
  }
  if (!isPrivate && loggedOut.status !== 200) {
    failures.push(`Public repo but logged-out PR page returned ${loggedOut.status}.`);
  }

  if (args.screenshot) {
    const images = [];
    for (const result of results) {
      const media = repoMediaPath(result.src, owner, repo);
      if (!media || !result.ok) continue;
      const response = await api(
        `repos/${owner}/${repo}/contents/${media.path}?ref=${media.ref}`,
        "application/vnd.github.raw",
      );
      const buffer = Buffer.from(await response.arrayBuffer());
      images.push({
        htmlSrc: result.src.replace(/&/g, "&amp;"),
        dataUrl: `data:${result.type};base64,${buffer.toString("base64")}`,
      });
    }
    await screenshotRendered(bodyHtml, images, `${pr.title} #${args.pr}`, args.screenshot);
  }

  const summary = {
    ok: failures.length === 0,
    pr: prUrl,
    repoPrivate: isPrivate,
    images: results,
    loggedOut,
    failures,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length > 0) process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (args.command === "publish") await publish(args);
else if (args.command === "check") await check(args);
else fail("Usage: pr-evidence.mjs publish|check [options] (see the PR evidence section of SKILL.md)");
