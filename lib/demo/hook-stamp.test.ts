import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { clearHookStamp, hookStampPath } from "./hook-stamp";

describe("hook stamp", () => {
  afterEach(() => {
    clearHookStamp();
  });

  it("removes the edited-files stamp when present", () => {
    fs.mkdirSync(path.dirname(hookStampPath), { recursive: true });
    fs.writeFileSync(hookStampPath, "components/banking/transfer-form.tsx\n");
    clearHookStamp();
    expect(fs.existsSync(hookStampPath)).toBe(false);
  });

  it("ignores a missing stamp", () => {
    expect(() => clearHookStamp()).not.toThrow();
  });
});
