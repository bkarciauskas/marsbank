// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  currentStage,
  elapsedMs,
  formatDuration,
  isComplete,
  renderCanvas,
} from "./tracker.mjs";

function runWith(statuses, startedAt = "2026-09-02T07:00:00.000Z") {
  const labels = [
    "Open the progress canvas",
    "Write failing unit tests",
    "Restore offset available debit",
    "Unit tests pass",
    "Drive verify-marsbank transfer",
    "Open the fix pull request",
  ];
  const ids = ["canvas", "tests-red", "fix", "tests-green", "verify", "pr"];
  return {
    startedAt,
    canvasPath: "/tmp/source.canvas.tsx",
    stages: ids.map((id, index) => ({
      id,
      label: labels[index],
      status: statuses[index],
      startedAt: statuses[index] === "pending" ? null : startedAt,
      endedAt: statuses[index] === "completed" ? "2026-09-02T07:00:08.000Z" : null,
      ms: statuses[index] === "completed" ? 8000 : null,
    })),
  };
}

describe("demo tracker", () => {
  it("formats short and long durations", () => {
    expect(formatDuration(12_400)).toBe("12.4s");
    expect(formatDuration(65_000)).toBe("1m 05s");
  });

  it("treats the first in-progress stage as current", () => {
    const run = runWith([
      "completed",
      "in_progress",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(currentStage(run).id).toBe("tests-red");
    expect(isComplete(run)).toBe(false);
  });

  it("sums completed stage times when the run is done", () => {
    const run = runWith(Array(6).fill("completed"));
    expect(isComplete(run)).toBe(true);
    expect(elapsedMs(run)).toBe(48_000);
  });

  it("renders a canvas with every planned stage and no empty copy", () => {
    const source = renderCanvas(
      runWith(["completed", "in_progress", "pending", "pending", "pending", "pending"]),
    );
    expect(source).toContain("cursor-canvas-title: Mars Bank pstack demo");
    expect(source).toContain("Write failing unit tests");
    expect(source).toContain("Open the fix pull request");
    expect(source).not.toContain("TODO");
    expect(source).not.toContain("No data");
  });
});
