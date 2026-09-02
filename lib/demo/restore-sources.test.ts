// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { demoSourceFiles, restoreDemoSources } from "./restore-sources";

const transferForm = path.join(process.cwd(), demoSourceFiles[0]);

describe("restoreDemoSources", () => {
  const original = fs.readFileSync(transferForm, "utf8");

  afterEach(() => {
    fs.writeFileSync(transferForm, original);
  });

  it("restores transfer-form.tsx from git HEAD", () => {
    fs.writeFileSync(
      transferForm,
      original.replace(
        /export function (TransferForm|SendForm)\(/,
        "export function SendForm(",
      ) + "\n// demo-restore-marker\n",
    );
    expect(fs.readFileSync(transferForm, "utf8")).toContain(
      "demo-restore-marker",
    );

    restoreDemoSources();

    const restored = fs.readFileSync(transferForm, "utf8");
    expect(restored).not.toContain("demo-restore-marker");
    expect(restored).toMatch(/export function TransferForm\(/);
  });
});
