// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hookActivityPath } from "@/lib/demo/hook-activity";
import { GET } from "./route";

describe("hook activity route", () => {
  afterEach(() => {
    try {
      fs.unlinkSync(hookActivityPath);
    } catch {
      // optional
    }
  });

  it("returns recorded hook events", async () => {
    fs.mkdirSync(path.dirname(hookActivityPath), { recursive: true });
    fs.writeFileSync(
      hookActivityPath,
      `${JSON.stringify({
        at: "2026-09-02T03:00:00.000Z",
        event: "afterFileEdit",
        detail: "Recorded edit · transfer-form.tsx",
      })}\n`,
    );

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      entries: [
        {
          at: "2026-09-02T03:00:00.000Z",
          event: "afterFileEdit",
          detail: "Recorded edit · transfer-form.tsx",
        },
      ],
    });
  });
});
