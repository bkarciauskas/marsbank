// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hookActivityPath } from "@/lib/demo/hook-activity";
import { hookStampPath } from "@/lib/demo/hook-stamp";
import {
  hookInstallPaths,
  hookKitInstalled,
  hookKits,
  uninstallAllHookKits,
} from "@/lib/demo/install-hooks";
import { revertAgentGuardrails } from "@/lib/demo/agent-guardrails";
import { DEMO_SCENARIO_COOKIE } from "@/lib/demo/scenarios";
import { accountId } from "@/lib/ids";
import { availableBalance } from "@/lib/ledger";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { tokens } from "@/lib/money";
import { GET, POST } from "./route";

function get(cookie = "") {
  return GET(
    new NextRequest("http://localhost/api/demo", {
      headers: cookie ? { cookie } : undefined,
    }),
  );
}

function post(body: unknown, cookie = "") {
  return POST(
    new NextRequest("http://localhost/api/demo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("demo route", () => {
  beforeEach(async () => {
    uninstallAllHookKits();
    await getLedgerRepository().resetAll("cameron");
  });

  afterEach(() => {
    revertAgentGuardrails();
    uninstallAllHookKits();
    try {
      fs.unlinkSync(hookStampPath);
    } catch {
      // stamp is optional
    }
    try {
      fs.unlinkSync(hookActivityPath);
    } catch {
      // activity log is optional
    }
  });

  it("reports an idle console when no walk is staged", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: null,
      hooksInstalled: false,
      guardrail: null,
    });
  });

  it("stages a walk, restores registers, and clears the hook stamp", async () => {
    fs.mkdirSync(hookStampPath.slice(0, hookStampPath.lastIndexOf("/")), {
      recursive: true,
    });
    fs.writeFileSync(hookStampPath, "lib/ledger.ts\n");
    fs.writeFileSync(
      hookActivityPath,
      `${JSON.stringify({
        at: "2026-09-02T03:00:00.000Z",
        event: "afterFileEdit",
        detail: "stale",
      })}\n`,
    );
    await getLedgerRepository().transfer("cameron", "demo-setup-transfer", {
      kind: "own",
      command: {
        from: accountId("acc-everyday"),
        to: accountId("acc-reserve"),
        amount: tokens(10_000),
        description: "",
      },
    });

    const transferForm = path.join(
      process.cwd(),
      "components/banking/transfer-form.tsx",
    );
    const originalForm = fs.readFileSync(transferForm, "utf8");
    fs.writeFileSync(
      transferForm,
      `${originalForm}\n// demo-route-restore-marker\n`,
    );

    try {
      const response = await post({ action: "setup", scenario: "hooks" });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        active: "hooks",
        hooksInstalled: true,
        guardrail: null,
      });
      expect(response.cookies.get(DEMO_SCENARIO_COOKIE)?.value).toBe("hooks");
      expect(fs.existsSync(hookStampPath)).toBe(false);
      expect(fs.existsSync(hookActivityPath)).toBe(false);
      expect(hookKitInstalled("hooks")).toBe(true);
      expect(fs.existsSync(hookInstallPaths.hooksJson)).toBe(true);
      for (const file of hookKits.hooks.scripts) {
        expect(
          fs.existsSync(path.join(hookInstallPaths.hooksDir, file)),
        ).toBe(true);
      }
      expect(fs.readFileSync(transferForm, "utf8")).not.toContain(
        "demo-route-restore-marker",
      );

      const cameron = await getLedgerRepository().getRegister("cameron");
      const everyday = cameron.accounts.find(
        (account) => account.id === "acc-everyday",
      );
      expect(everyday && availableBalance(everyday)).toBe(1_000_184_220);
    } finally {
      fs.writeFileSync(transferForm, originalForm);
    }
  });

  it("clears the staged walk on reset-all", async () => {
    const staged = await post({ action: "setup", scenario: "debug-mode" });
    expect(staged.cookies.get(DEMO_SCENARIO_COOKIE)?.value).toBe("debug-mode");

    const response = await post(
      { action: "reset-all" },
      `${DEMO_SCENARIO_COOKIE}=debug-mode`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: null,
      hooksInstalled: false,
      guardrail: null,
    });
    expect(response.cookies.get(DEMO_SCENARIO_COOKIE)?.value).toBe("");
  });

  it("uninstalls hooks when the hooks walk is reset", async () => {
    await post({ action: "setup", scenario: "hooks" });
    expect(hookKitInstalled("hooks")).toBe(true);

    const response = await post(
      { action: "reset", scenario: "hooks" },
      `${DEMO_SCENARIO_COOKIE}=hooks`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: null,
      hooksInstalled: false,
      guardrail: null,
    });
    expect(hookKitInstalled("hooks")).toBe(false);
  });

  it("resets one walk without clearing a different staged walk", async () => {
    const response = await post(
      { action: "reset", scenario: "hooks" },
      `${DEMO_SCENARIO_COOKIE}=debug-mode`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      active: "debug-mode",
      hooksInstalled: false,
      guardrail: null,
    });
    expect(response.cookies.get(DEMO_SCENARIO_COOKIE)?.value).toBe("debug-mode");
  });

  it("plants a ledger import on the lint walk and removes it on reset", async () => {
    const staged = await post({ action: "setup", scenario: "agent-lint" });
    const body = (await staged.json()) as {
      active: string;
      guardrail: { output: string };
    };
    expect(body.active).toBe("agent-lint");
    expect(body.guardrail.output).toContain("useBank()");
    expect(
      fs.existsSync(
        path.join(process.cwd(), "components/demo/planted-ledger-import.tsx"),
      ),
    ).toBe(true);

    const reset = await post(
      { action: "reset", scenario: "agent-lint" },
      `${DEMO_SCENARIO_COOKIE}=agent-lint`,
    );
    expect((await reset.json()).active).toBeNull();
    expect(
      fs.existsSync(
        path.join(process.cwd(), "components/demo/planted-ledger-import.tsx"),
      ),
    ).toBe(false);
  });

  it("rejects an unknown action or walk", async () => {
    expect((await post({ action: "stage" })).status).toBe(400);
    expect((await post({ action: "setup", scenario: "other" })).status).toBe(
      400,
    );
  });
});
