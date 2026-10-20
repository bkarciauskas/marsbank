import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DemoScenarioId } from "./scenarios";

const lockPath = path.join(os.tmpdir(), "marsbank-agent-guardrails.lock");

export const agentLintFile = "components/demo/planted-ledger-import.tsx";
export const agentRouteFile = "app/api/payees/route.ts";
export const agentAccountsFile = "app/banking/accounts/page.tsx";
export const goldenRouteFile = "app/api/transfers/route.ts";

const healthyHeading = "<h1>Token register</h1>";
const plantedHeading = "<h1>Token ledger</h1>";

const lintSource = `"use client";

import { getLedgerRepository } from "@/lib/server/ledger-repository";

export function PlantedLedgerImport() {
  const repository = getLedgerRepository;
  return repository.name;
}
`;

const routeSource = `import { NextResponse } from "next/server";

export function POST() {
  return NextResponse.json({ payee: "planted" });
}
`;

function absolute(relativePath: string): string {
  return path.join(process.cwd(), relativePath);
}

function missing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function readText(relativePath: string): string {
  return fs.readFileSync(absolute(relativePath), "utf8");
}

export async function withAgentLock<T>(fn: () => Promise<T> | T): Promise<T> {
  const started = Date.now();
  let fd: number | null = null;
  while (fd === null) {
    try {
      fd = fs.openSync(lockPath, "wx");
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "EEXIST"
        )
      ) {
        throw error;
      }
      if (Date.now() - started > 30_000) {
        throw new Error("Timed out waiting for the agent-guardrails plant lock.");
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  try {
    return await fn();
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(lockPath);
    } catch (error) {
      if (!missing(error)) throw error;
    }
  }
}

export function plantAgentLint(): void {
  const file = absolute(agentLintFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, lintSource);
}

export function revertAgentLint(): void {
  try {
    fs.unlinkSync(absolute(agentLintFile));
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

export function plantAgentVerify(): void {
  const source = readText(agentAccountsFile);
  if (source.includes(plantedHeading)) return;
  if (!source.includes(healthyHeading)) {
    throw new Error(
      "Accounts heading is not the known Token register line. Refusing to plant.",
    );
  }
  fs.writeFileSync(
    absolute(agentAccountsFile),
    source.replace(healthyHeading, plantedHeading),
  );
}

export function revertAgentVerify(): void {
  const source = readText(agentAccountsFile);
  if (!source.includes(plantedHeading)) return;
  fs.writeFileSync(
    absolute(agentAccountsFile),
    source.replace(plantedHeading, healthyHeading),
  );
}

export function plantAgentRoute(): void {
  const file = absolute(agentRouteFile);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, routeSource);
}

export function revertAgentRoute(): void {
  try {
    fs.unlinkSync(absolute(agentRouteFile));
  } catch (error) {
    if (!missing(error)) throw error;
  }
}

export function plantAgentScenario(id: DemoScenarioId): void {
  if (id === "agent-lint") plantAgentLint();
  else if (id === "agent-verify") plantAgentVerify();
  else if (id === "agent-route") plantAgentRoute();
}

export function revertAgentScenario(id: DemoScenarioId): void {
  if (id === "agent-lint") revertAgentLint();
  else if (id === "agent-verify") revertAgentVerify();
  else if (id === "agent-route") revertAgentRoute();
}

export function revertAgentGuardrails(): void {
  revertAgentLint();
  revertAgentVerify();
  revertAgentRoute();
}

function runCommand(
  command: string,
  args: string[],
  timeout: number,
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        cwd: process.cwd(),
        timeout,
        maxBuffer: 2_000_000,
        env: {
          ...process.env,
          PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ""}`,
        },
      },
      (error, stdout, stderr) => {
        const output = `${stdout}${stderr}`.trim();
        resolve({
          ok: error === null,
          output: output || (error ? error.message : ""),
        });
      },
    );
  });
}

async function lintGuardrail(): Promise<string> {
  if (!fs.existsSync(absolute(agentLintFile))) {
    throw new Error(`Missing planted file ${agentLintFile}.`);
  }
  const eslint = absolute("node_modules/eslint/bin/eslint.js");
  const result = await runCommand(process.execPath, [eslint, agentLintFile], 60_000);
  return `$ node ${eslint} ${agentLintFile}\n${result.output}`;
}

async function verifyGuardrail(): Promise<string> {
  if (process.env.VITEST) {
    return [
      "Planted app/banking/accounts/page.tsx heading: Token ledger",
      "e2e/sign-in.mjs expects heading: Token register",
      "npm run test:e2e",
    ].join("\n");
  }
  const script = absolute("e2e/sign-in.mjs");
  const result = await runCommand(process.execPath, [script], 120_000);
  return `$ node e2e/sign-in.mjs\nexit:${result.ok ? 0 : 1}\n${result.output}`;
}

function finishCommands(): string {
  const agents = readText("AGENTS.md");
  const match = agents.match(/## Before you finish\s+```bash\n([\s\S]*?)```/);
  return match?.[1]?.trim() || "npx tsc --noEmit\nnpm run lint\nnpm run test";
}

function routeGuardrail(): string {
  const planted = readText(agentRouteFile);
  const golden = readText(goldenRouteFile);
  const callsRepository = planted.includes("getLedgerRepository");
  const goldenLines = golden
    .split("\n")
    .slice(0, 16)
    .join("\n");
  return [
    callsRepository
      ? `${agentRouteFile} calls getLedgerRepository().`
      : `${agentRouteFile} does not call getLedgerRepository().`,
    `Copy ${goldenRouteFile}.`,
    "Before you finish:",
    finishCommands(),
    "",
    `${goldenRouteFile}:`,
    goldenLines,
  ].join("\n");
}

export async function agentGuardrail(id: DemoScenarioId): Promise<string> {
  if (id === "agent-lint") return lintGuardrail();
  if (id === "agent-verify") return verifyGuardrail();
  if (id === "agent-route") return routeGuardrail();
  return "";
}
