// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import scenario from "../scenarios/offset-hold/scenario.mjs";
import {
  applyEdits,
  applyVariant,
  assignSeats,
  classifyEditOrder,
  findLeaks,
  redact,
  shuffle,
  summarize,
} from "./eval.mjs";

const repoRoot = join(__dirname, "..", "..", "..", "..");
const read = (file: string) => readFileSync(join(repoRoot, file), "utf8");

describe("applyEdits", () => {
  it("applies each edit once and leaves the input untouched", () => {
    const files = { "a.ts": "one two" };
    expect(applyEdits(files, [{ file: "a.ts", find: "two", replace: "2" }])).toEqual({ "a.ts": "one 2" });
    expect(files).toEqual({ "a.ts": "one two" });
  });

  it("refuses an edit that matches zero or many times", () => {
    expect(() => applyEdits({ "a.ts": "x" }, [{ file: "a.ts", find: "y", replace: "" }])).toThrow(/0 times/);
    expect(() => applyEdits({ "a.ts": "yy" }, [{ file: "a.ts", find: "y", replace: "" }])).toThrow(/2 times/);
    expect(() => applyEdits({}, [{ file: "a.ts", find: "y", replace: "" }])).toThrow(/missing/);
  });
});

describe("offset-hold scenario against this repo", () => {
  const targets = [...new Set(scenario.edits.map((edit: { file: string }) => edit.file))];
  const files = Object.fromEntries(targets.map((file) => [file, read(file)]));

  it("plants the bug and strips every assertion that would reveal it", () => {
    const planted = applyEdits(files, scenario.edits);
    expect(planted["lib/ledger.ts"]).toContain("available: account.available,");
    const leaks = findLeaks({ prompt: "", path: "/work/x", files: planted, leaks: scenario.leaks });
    expect(leaks).toEqual([]);
  });

  it("ships a prompt with no meta words or answer strings", () => {
    const prompt = scenario.prompt.replaceAll("{{repo}}", "/home/ubuntu/work/kestrel/marsbank");
    expect(findLeaks({ prompt, path: "/home/ubuntu/work/kestrel/marsbank", files: {}, leaks: scenario.leaks })).toEqual([]);
  });
});

describe("applyVariant", () => {
  it("appends to existing files and writes new ones", () => {
    const next = applyVariant({ "AGENTS.md": "# Rules\n\n" }, { append: { "AGENTS.md": "\nMore.\n" }, write: { "x.md": "new" } });
    expect(next).toEqual({ "AGENTS.md": "# Rules\n\nMore.\n", "x.md": "new" });
  });

  it("leaves the tree alone for a baseline variant", () => {
    expect(applyVariant({ "a.md": "a" }, {})).toEqual({ "a.md": "a" });
  });
});

describe("assignSeats", () => {
  it("covers every variant and model per trial with unique labels", () => {
    const seats = assignSeats({ variants: ["baseline", "guided"], models: ["m1", "m2"], trials: 2, labels: shuffle(["a", "b", "c", "d", "e", "f", "g", "h"]) });
    expect(seats).toHaveLength(8);
    expect(new Set(seats.map((seat) => seat.label)).size).toBe(8);
    for (const variant of ["baseline", "guided"]) {
      for (const model of ["m1", "m2"]) {
        expect(seats.filter((seat) => seat.variant === variant && seat.model === model)).toHaveLength(2);
      }
    }
  });

  it("refuses to run short of labels", () => {
    expect(() => assignSeats({ variants: ["a", "b"], models: ["m"], trials: 1, labels: ["x"] })).toThrow(/need 2 labels/);
  });
});

describe("findLeaks", () => {
  it("flags meta words in the prompt and path, and answer strings in files", () => {
    const leaks = findLeaks({
      prompt: "Please write a test",
      path: "/tmp/judge-run/repo",
      files: { "lib/a.ts": "const x = 42;" },
      leaks: ["42"],
    });
    expect(leaks).toEqual([
      { where: "prompt", term: "test" },
      { where: "path", term: "judge" },
      { where: "lib/a.ts", term: "42" },
    ]);
  });
});

describe("classifyEditOrder", () => {
  const target = "lib/ledger.ts";
  const at = (t: number, path: string) => ({ t, path });

  it("reads the first touch of each file from the trace", () => {
    const testFiles = ["lib/ledger.test.ts"];
    expect(classifyEditOrder([at(1, "lib/ledger.test.ts"), at(2, target)], { target, testFiles })).toBe("test-first");
    expect(classifyEditOrder([at(1, target), at(2, "lib/ledger.test.ts")], { target, testFiles })).toBe("fix-first");
    expect(classifyEditOrder([at(1, target)], { target, testFiles: [] })).toBe("no-test");
    expect(classifyEditOrder([at(1, "lib/ledger.test.ts")], { target, testFiles })).toBe("no-fix");
    expect(classifyEditOrder([], { target, testFiles: [] })).toBe("no-change");
  });

  it("ignores touches to test files the candidate did not keep", () => {
    const events = [at(1, "lib/scratch.test.ts"), at(2, target), at(3, "lib/ledger.test.ts")];
    expect(classifyEditOrder(events, { target, testFiles: ["lib/ledger.test.ts"] })).toBe("fix-first");
  });
});

describe("redact", () => {
  it("hides lines that would reveal which guidance the repo carried", () => {
    expect(redact("Fixed debit.\nPer AGENTS.md I used tdd.\nDone.")).toBe("Fixed debit.\n[redacted: line cites repo guidance]\nDone.");
  });
});

describe("summarize", () => {
  it("rolls grades and judge totals up by variant", () => {
    const seats = [
      { label: "a", variant: "baseline" },
      { label: "b", variant: "guided" },
    ];
    const grades = {
      a: { order: "fix-first", mutation: "catches", holdout: "pass" },
      b: { order: "test-first", mutation: "catches", holdout: "pass" },
    };
    expect(summarize(seats, grades, { a: 6, b: 9 })).toEqual({
      baseline: { seats: 1, testFirst: 0, catches: 1, holdout: 1, judge: [6] },
      guided: { seats: 1, testFirst: 1, catches: 1, holdout: 1, judge: [9] },
    });
  });
});
