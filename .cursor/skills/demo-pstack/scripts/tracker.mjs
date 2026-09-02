#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const runDir = join(kitRoot, ".run");
export const runPath = join(runDir, "fix-run.json");

export const stageCatalog = [
  { id: "canvas", label: "Open the progress canvas" },
  { id: "tests-red", label: "Write failing unit tests" },
  { id: "fix", label: "Restore offset available debit" },
  { id: "tests-green", label: "Unit tests pass" },
  { id: "verify", label: "Drive verify-marsbank transfer" },
  { id: "pr", label: "Open the fix pull request" },
];

const stageIds = new Set(stageCatalog.map((stage) => stage.id));

function fail(message) {
  console.error(message);
  process.exit(1);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}

function writeJson(path, value) {
  ensureDir(dirname(path));
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function mintCanvasId() {
  try {
    return readFileSync("/proc/sys/kernel/random/uuid", "utf8").trim().toLowerCase();
  } catch {
    return execFileSync("python3", ["-c", "import uuid; print(uuid.uuid4())"], {
      encoding: "utf8",
    }).trim().toLowerCase();
  }
}

/** @param {number} ms */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "0.0s";
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function emptyStages() {
  return stageCatalog.map((stage) => ({
    id: stage.id,
    label: stage.label,
    status: "pending",
    startedAt: null,
    endedAt: null,
    ms: null,
  }));
}

/** @param {object} run */
export function currentStage(run) {
  return (
    run.stages.find((stage) => stage.status === "in_progress") ??
    run.stages.find((stage) => stage.status === "pending") ??
    run.stages[run.stages.length - 1]
  );
}

/** @param {object} run */
export function isComplete(run) {
  return run.stages.every((stage) => stage.status === "completed");
}

/** @param {object} run */
export function elapsedMs(run, now = Date.now()) {
  if (isComplete(run)) {
    return run.stages.reduce((total, stage) => total + (stage.ms ?? 0), 0);
  }
  return Math.max(0, now - Date.parse(run.startedAt));
}

export function loadRun() {
  if (!existsSync(runPath)) return null;
  return JSON.parse(readFileSync(runPath, "utf8"));
}

export function createRun(now = new Date()) {
  const canvasId = mintCanvasId();
  const run = {
    runId: now.toISOString().replace(/[:.]/g, "-"),
    startedAt: now.toISOString(),
    canvasId,
    canvasPath: `/cursor/stores/user/canvases/${canvasId}/source.canvas.tsx`,
    stages: emptyStages(),
  };
  writeJson(runPath, run);
  return run;
}

function saveRun(run) {
  writeJson(runPath, run);
  return run;
}

/** @param {object} run */
export function renderCanvas(run) {
  const now = Date.now();
  const current = currentStage(run);
  const complete = isComplete(run);
  const elapsed = formatDuration(elapsedMs(run, now));
  const payload = {
    startedAt: run.startedAt,
    canvasPath: run.canvasPath,
    complete,
    elapsed,
    total: complete ? elapsed : null,
    currentId: current.id,
    currentLabel: complete ? "Complete" : current.label,
    stages: run.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      status: stage.status,
      duration: stage.ms == null ? "pending" : formatDuration(stage.ms),
    })),
  };
  const data = JSON.stringify(payload, null, 2);
  return `// cursor-canvas-title: Mars Bank pstack demo
import {
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  Stack,
  Stat,
  Table,
  Text,
  TodoList,
  UsageBar,
} from "cursor/canvas";

const run = ${data} as const;

const doneCount = run.stages.filter((stage) => stage.status === "completed").length;

export default function DemoFixBoard() {
  return (
    <Stack gap={20}>
      <H1>Mars Bank pstack demo</H1>
      <Text>
        {run.complete
          ? \`Finished in \${run.total}. Started \${run.startedAt}.\`
          : \`In progress. Started \${run.startedAt}.\`}
      </Text>
      <Grid columns={3} gap={16}>
        <Stat
          value={run.currentLabel}
          label="Current stage"
          tone={run.complete ? "success" : "info"}
        />
        <Stat value={run.elapsed} label="Elapsed" />
        <Stat
          value={run.total ?? run.elapsed}
          label={run.complete ? "Total runtime" : "Running total"}
          tone={run.complete ? "success" : undefined}
        />
      </Grid>
      <UsageBar
        total={run.stages.length}
        segments={[{ id: "done", value: doneCount }]}
        topLeftLabel={\`\${doneCount} of \${run.stages.length} stages\`}
        topRightLabel={run.complete ? "Done" : run.currentLabel}
      />
      <Card>
        <CardHeader>Flow</CardHeader>
        <CardBody>
          <TodoList
            todos={run.stages.map((stage) => ({
              id: stage.id,
              content: stage.label,
              status:
                stage.status === "completed"
                  ? "completed"
                  : stage.status === "in_progress"
                    ? "in_progress"
                    : "pending",
            }))}
          />
        </CardBody>
      </Card>
      <Table
        headers={["Stage", "Status", "Duration"]}
        rows={run.stages.map((stage) => [stage.label, stage.status, stage.duration])}
        columnAlign={["left", "left", "right"]}
        rowTone={run.stages.map((stage) =>
          stage.status === "completed"
            ? "success"
            : stage.status === "in_progress"
              ? "info"
              : "neutral",
        )}
      />
    </Stack>
  );
}
`;
}

function writeCanvas(run) {
  const source = renderCanvas(run);
  ensureDir(dirname(run.canvasPath));
  writeFileSync(run.canvasPath, source);
  writeFileSync(join(runDir, "source.canvas.tsx"), source);
  return source;
}

export function startStage(id, now = new Date()) {
  const run = loadRun();
  if (!run) throw new Error("Tracker: no run. Init first.");
  if (!stageIds.has(id)) throw new Error(`Tracker: unknown stage "${id}".`);
  const index = run.stages.findIndex((stage) => stage.id === id);
  const stage = run.stages[index];
  if (stage.status === "completed") return saveRun(run);
  for (let i = 0; i < index; i += 1) {
    if (run.stages[i].status !== "completed") {
      throw new Error(`Tracker: finish ${run.stages[i].id} before ${id}.`);
    }
  }
  if (stage.status === "pending") {
    stage.status = "in_progress";
    stage.startedAt = now.toISOString();
  }
  return saveRun(run);
}

export function finishStage(id, now = new Date()) {
  const run = startStage(id, now);
  const stage = run.stages.find((item) => item.id === id);
  if (stage.status === "completed") return run;
  const started = Date.parse(stage.startedAt ?? now.toISOString());
  stage.status = "completed";
  stage.endedAt = now.toISOString();
  stage.ms = Math.max(0, now.getTime() - started);
  return saveRun(run);
}

const isCli =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const verb = process.argv[2];
  const id = process.argv[3];
  try {
    let run;
    if (verb === "init") {
      run = createRun();
    } else if (verb === "status") {
      run = loadRun();
      if (!run) fail("Tracker: no run. Init first.");
    } else if (verb === "start" && id) {
      run = startStage(id);
    } else if (verb === "done" && id) {
      run = finishStage(id);
    } else {
      fail("Tracker: use init, status, start <id>, or done <id>.");
    }
    writeCanvas(run);
    console.log(
      JSON.stringify(
        {
          ok: true,
          verb,
          canvasPath: run.canvasPath,
          complete: isComplete(run),
          current: currentStage(run),
          elapsed: formatDuration(elapsedMs(run)),
          run,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
