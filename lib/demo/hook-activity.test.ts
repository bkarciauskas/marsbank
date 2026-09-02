import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  clearHookActivity,
  hookActivityPath,
  readHookActivity,
} from "./hook-activity";

describe("hook activity", () => {
  afterEach(() => {
    clearHookActivity();
  });

  it("reads appended jsonl entries and clears them", () => {
    fs.mkdirSync(path.dirname(hookActivityPath), { recursive: true });
    fs.writeFileSync(
      hookActivityPath,
      `${JSON.stringify({
        at: "2026-09-02T03:00:00.000Z",
        event: "afterFileEdit",
        detail: "Recorded edit · components/banking/transfer-form.tsx",
      })}\n${JSON.stringify({
        at: "2026-09-02T03:00:05.000Z",
        event: "stop",
        detail: "npm test passed",
        ok: true,
      })}\n`,
    );

    expect(readHookActivity()).toEqual([
      {
        at: "2026-09-02T03:00:00.000Z",
        event: "afterFileEdit",
        detail: "Recorded edit · components/banking/transfer-form.tsx",
      },
      {
        at: "2026-09-02T03:00:05.000Z",
        event: "stop",
        detail: "npm test passed",
        ok: true,
      },
    ]);

    clearHookActivity();
    expect(fs.existsSync(hookActivityPath)).toBe(false);
    expect(readHookActivity()).toEqual([]);
  });

  it("skips malformed lines", () => {
    fs.mkdirSync(path.dirname(hookActivityPath), { recursive: true });
    fs.writeFileSync(
      hookActivityPath,
      `not-json\n${JSON.stringify({
        at: "2026-09-02T03:00:00.000Z",
        event: "stop",
        detail: "ok",
      })}\n`,
    );
    expect(readHookActivity()).toEqual([
      {
        at: "2026-09-02T03:00:00.000Z",
        event: "stop",
        detail: "ok",
      },
    ]);
  });
});
