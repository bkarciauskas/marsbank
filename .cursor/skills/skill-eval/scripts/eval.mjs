#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  watch,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(kitRoot, "..", "..", "..");
const runsRoot = join(kitRoot, ".runs");

export const BANNED_META = [
  "eval",
  "test",
  "judge",
  "experiment",
  "rubric",
  "score",
  "compare",
  "benchmark",
  "candidate",
  "arena",
];

const LABELS = [
  "kestrel", "osprey", "plover", "heron", "wren", "finch",
  "tern", "egret", "avocet", "merlin", "dunlin", "curlew",
];

const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;
const HOLDOUT_FILE = "lib/zz-holdout.test.ts";
const WATCHED_DIRS = ["lib", "app", "components", "test-utils"];

/** Each edit must match exactly once, so a drifted repo fails setup instead of producing a silently different task. */
export function applyEdits(files, edits) {
  const next = { ...files };
  for (const { file, find, replace } of edits) {
    if (next[file] === undefined) throw new Error(`edit target missing: ${file}`);
    const source = String(next[file]);
    const count = source.split(find).length - 1;
    if (count !== 1) throw new Error(`edit in ${file} matched ${count} times, want 1`);
    next[file] = source.replace(find, replace);
  }
  return next;
}

export function applyVariant(files, variant) {
  const next = { ...files };
  for (const [file, text] of Object.entries(variant.append ?? {})) {
    if (next[file] === undefined) throw new Error(`append target missing: ${file}`);
    next[file] = String(next[file]).replace(/\n*$/, "\n") + text;
  }
  for (const [file, text] of Object.entries(variant.write ?? {})) next[file] = text;
  return next;
}

/** Interleaves variants so a model never runs every trial of one variant before the other. */
export function assignSeats({ variants, models, trials, labels }) {
  const seats = [];
  for (let trial = 1; trial <= trials; trial++) {
    for (const model of models) {
      for (const variant of variants) seats.push({ variant, model, trial });
    }
  }
  if (labels.length < seats.length) throw new Error(`need ${seats.length} labels, have ${labels.length}`);
  return seats.map((seat, i) => ({ label: labels[i], ...seat }));
}

export function shuffle(items, pick = randomInt) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Meta words are checked where the candidate reads our framing (prompt, path); answer strings anywhere it can read. */
export function findLeaks({ prompt, path, files, leaks }) {
  const found = [];
  for (const word of BANNED_META) {
    const pattern = new RegExp(`\\b${word}`, "i");
    if (pattern.test(prompt)) found.push({ where: "prompt", term: word });
    if (path.split("/").some((segment) => pattern.test(segment))) found.push({ where: "path", term: word });
  }
  for (const term of leaks) {
    if (prompt.includes(term)) found.push({ where: "prompt", term });
    for (const [file, text] of Object.entries(files)) {
      if (file.includes(term) || String(text).includes(term)) found.push({ where: file, term });
    }
  }
  return found;
}

/** Order comes from the file-watch trace, never from what the candidate says it did. */
export function classifyEditOrder(events, { target, testFiles }) {
  const first = (match) => events.find((event) => match(event.path))?.t;
  const fixAt = first((path) => path === target);
  const testAt = first((path) => testFiles.includes(path));
  if (testAt === undefined) return fixAt === undefined ? "no-change" : "no-test";
  if (fixAt === undefined) return "no-fix";
  return testAt < fixAt ? "test-first" : "fix-first";
}

export function redact(reply) {
  return reply
    .split("\n")
    .map((line) => (/AGENTS\.md|\.cursor\/skills|SKILL\.md|\btdd\b/i.test(line) ? "[redacted: line cites repo guidance]" : line))
    .join("\n");
}

export function summarize(seats, grades, scores = {}) {
  const groups = {};
  for (const seat of seats) {
    const grade = grades[seat.label];
    const group = (groups[seat.variant] ??= { seats: 0, testFirst: 0, catches: 0, holdout: 0, judge: [] });
    group.seats += 1;
    if (grade.order === "test-first") group.testFirst += 1;
    if (grade.mutation === "catches") group.catches += 1;
    if (grade.holdout === "pass") group.holdout += 1;
    if (scores[seat.label] !== undefined) group.judge.push(scores[seat.label]);
  }
  return groups;
}

function sh(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, CI: "1", FORCE_COLOR: "0" } });
  return { ok: result.status === 0, out: `${result.stdout}${result.stderr}` };
}

const vitest = (root, files = []) => sh("npx", ["vitest", "run", ...files], root);

function failureLine(out) {
  return out.split("\n").find((line) => /AssertionError|expected .* to (be|equal)/.test(line))?.trim() ?? "";
}

function runHoldout(root, holdout) {
  writeFileSync(join(root, HOLDOUT_FILE), holdout);
  try {
    const run = vitest(root, [HOLDOUT_FILE]);
    return { result: run.ok ? "pass" : "fail", detail: failureLine(run.out) };
  } finally {
    rmSync(join(root, HOLDOUT_FILE), { force: true });
  }
}

async function loadScenario(id) {
  const path = join(kitRoot, "scenarios", id, "scenario.mjs");
  return { ...(await import(pathToFileURL(path).href)).default, dir: dirname(path) };
}

function readTracked(exclude) {
  const list = sh("git", ["ls-files", "-z"], repoRoot).out.split("\0").filter(Boolean);
  const files = {};
  for (const file of list) {
    if (exclude.some((prefix) => file.startsWith(prefix))) continue;
    if (!existsSync(join(repoRoot, file))) continue;
    files[file] = readFileSync(join(repoRoot, file));
  }
  return files;
}

function readTree(root, files) {
  return Object.fromEntries(Object.keys(files).map((file) => [file, readFileSync(join(root, file), "utf8")]));
}

const runDir = (runId) => join(runsRoot, runId);
const readKey = (runId) => JSON.parse(readFileSync(join(runDir(runId), "key.json"), "utf8"));

function writeSeat(root, files) {
  rmSync(root, { recursive: true, force: true });
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  sh("cp", ["-al", join(repoRoot, "node_modules"), join(root, "node_modules")], repoRoot);
  const git = (...args) => sh("git", ["-c", "user.name=Mars Bank", "-c", "user.email=dev@marsbank.example", ...args], root);
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "Initial import");
  return git("rev-parse", "HEAD").out.trim();
}

async function setup(flags) {
  const scenario = await loadScenario(flags.scenario ?? "offset-hold");
  const models = (flags.models ?? "claude-opus-5-5-high,grok-4.7-high").split(",");
  const trials = Number(flags.trials ?? 1);
  const base = flags.root ?? join(homedir(), "work");
  const runId = flags.run ?? `${scenario.id}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
  const dir = runDir(runId);
  mkdirSync(join(dir, "prompts"), { recursive: true });
  mkdirSync(join(dir, "replies"), { recursive: true });

  const planted = applyEdits(readTracked(scenario.exclude), scenario.edits);
  const seats = assignSeats({ variants: Object.keys(scenario.variants), models, trials, labels: shuffle(LABELS) });
  for (const seat of seats) {
    seat.root = join(base, seat.label, scenario.repoName);
    seat.initialSha = writeSeat(seat.root, applyVariant(planted, scenario.variants[seat.variant]));
    writeFileSync(join(dir, "prompts", `${seat.label}.md`), scenario.prompt.replaceAll("{{repo}}", seat.root));
  }
  writeFileSync(join(dir, "key.json"), JSON.stringify({ runId, scenario: scenario.id, seats }, null, 2));
  console.log(JSON.stringify({ runId, seats: seats.map(({ label, root }) => ({ label, root })) }, null, 2));
  await check({ _: [runId] });
}

async function check(flags) {
  const key = readKey(flags._[0]);
  const scenario = await loadScenario(key.scenario);
  let ok = true;
  for (const seat of key.seats) {
    const prompt = readFileSync(join(runDir(key.runId), "prompts", `${seat.label}.md`), "utf8");
    const tracked = sh("git", ["ls-files", "-z"], seat.root).out.split("\0").filter(Boolean);
    const files = readTree(seat.root, Object.fromEntries(tracked.map((file) => [file, ""])));
    const leaks = findLeaks({ prompt, path: seat.root, files, leaks: scenario.leaks });
    const suite = vitest(seat.root);
    const holdout = runHoldout(seat.root, scenario.holdout);
    const seatOk = leaks.length === 0 && suite.ok && holdout.result === "fail";
    ok &&= seatOk;
    console.log(JSON.stringify({ label: seat.label, leaks, suiteGreenWithBug: suite.ok, holdoutRedWithBug: holdout.result === "fail", holdout: holdout.detail, ok: seatOk }));
  }
  if (!ok) {
    console.error("check failed: a seat leaks the answer, or the bug is visible to the repo suite, or the holdout cannot see it");
    process.exit(1);
  }
}

function trace(flags) {
  const key = readKey(flags._[0]);
  const out = join(runDir(key.runId), "trace.jsonl");
  for (const seat of key.seats) {
    const log = (prefix) => (_event, name) => {
      if (!name) return;
      const path = prefix ? `${prefix}/${name}` : name;
      if (path.includes("node_modules") || path === HOLDOUT_FILE) return;
      appendFileSync(out, `${JSON.stringify({ t: Date.now(), label: seat.label, path })}\n`);
    };
    watch(seat.root, log(""));
    for (const sub of WATCHED_DIRS) {
      if (existsSync(join(seat.root, sub))) watch(join(seat.root, sub), { recursive: true }, log(sub));
    }
  }
  console.log(`tracing ${key.seats.length} seats into ${out}`);
}

async function grade(flags) {
  const key = readKey(flags._[0]);
  const scenario = await loadScenario(key.scenario);
  const dir = runDir(key.runId);
  const tracePath = join(dir, "trace.jsonl");
  const events = existsSync(tracePath)
    ? readFileSync(tracePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line))
    : [];
  const judge = join(dir, "judge");
  mkdirSync(judge, { recursive: true });
  const grades = {};

  for (const seat of key.seats) {
    const git = (...args) => sh("git", args, seat.root).out;
    git("add", "-A");
    const changed = git("diff", "--cached", "--name-only", seat.initialSha).split("\n").filter(Boolean);
    const testFiles = changed.filter((file) => TEST_FILE.test(file) && existsSync(join(seat.root, file)));
    const prodFiles = changed.filter((file) => !testFiles.includes(file));
    const prodLines = git("diff", "--cached", "--numstat", seat.initialSha, "--", ...(prodFiles.length ? prodFiles : ["."]))
      .split("\n")
      .filter((line) => prodFiles.length && line)
      .reduce((sum, line) => sum + (Number(line.split("\t")[0]) || 0) + (Number(line.split("\t")[1]) || 0), 0);
    writeFileSync(join(judge, `${seat.label}.patch`), git("diff", "--cached", seat.initialSha));

    let mutation = "no-test";
    if (testFiles.length) {
      const fixed = readFileSync(join(seat.root, scenario.target), "utf8");
      writeFileSync(join(seat.root, scenario.target), git("show", `${seat.initialSha}:${scenario.target}`));
      try {
        mutation = vitest(seat.root, testFiles).ok ? "misses" : "catches";
      } finally {
        writeFileSync(join(seat.root, scenario.target), fixed);
      }
    }

    const holdout = runHoldout(seat.root, scenario.holdout);
    const replyPath = join(dir, "replies", `${seat.label}.md`);
    if (existsSync(replyPath)) writeFileSync(join(judge, `${seat.label}.reply.md`), redact(readFileSync(replyPath, "utf8")));

    grades[seat.label] = {
      holdout: holdout.result,
      suite: vitest(seat.root).ok ? "green" : "red",
      mutation,
      order: classifyEditOrder(events.filter((event) => event.label === seat.label), { target: scenario.target, testFiles }),
      testFiles,
      prodFiles,
      prodLines,
    };
  }
  writeFileSync(join(judge, "grades.json"), JSON.stringify(grades, null, 2));
  cpSync(join(scenario.dir, "rubric.md"), join(judge, "rubric.md"));
  console.log(JSON.stringify(grades, null, 2));
}

function unblind(flags) {
  const key = readKey(flags._[0]);
  const dir = runDir(key.runId);
  const grades = JSON.parse(readFileSync(join(dir, "judge", "grades.json"), "utf8"));
  const scoresPath = join(dir, "scores.json");
  const scores = existsSync(scoresPath) ? JSON.parse(readFileSync(scoresPath, "utf8")) : {};
  for (const seat of key.seats) {
    console.log(JSON.stringify({ label: seat.label, variant: seat.variant, model: seat.model, judge: scores[seat.label], ...grades[seat.label] }));
  }
  console.log(JSON.stringify(summarize(key.seats, grades, scores), null, 2));
}

function parseFlags(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) flags[argv[i].slice(2)] = argv[++i];
    else flags._.push(argv[i]);
  }
  return flags;
}

const commands = { setup, check, trace, grade, unblind };
const isCli = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const [name, ...rest] = process.argv.slice(2);
  const command = commands[name];
  if (!command) {
    console.error(`usage: eval.mjs <${Object.keys(commands).join("|")}> ...`);
    process.exit(1);
  }
  await command(parseFlags(rest));
}
