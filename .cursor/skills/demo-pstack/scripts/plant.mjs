#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const kitRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
export const repoRoot = join(kitRoot, "..", "..", "..");
export const defaultTarget = join(repoRoot, "lib", "ledger.ts");

export const healthyDebit = `    case "offset":
      if (account.available < amount) return null;
      return {
        ...account,
        available: subtractTokens(account.available, amount),
        current: subtractTokens(account.current, amount),
      };`;

export const plantedDebit = `    case "offset":
      if (account.available < amount) return null;
      return {
        ...account,
        available: account.available,
        current: subtractTokens(account.current, amount),
      };`;

/** @typedef {"healthy" | "planted" | "unknown"} PlantState */

/** @param {string} source */
export function plantState(source) {
  const healthy = source.includes(healthyDebit);
  const planted = source.includes(plantedDebit);
  if (healthy && planted) return "unknown";
  if (planted) return "planted";
  if (healthy) return "healthy";
  return "unknown";
}

/**
 * @param {string} source
 * @returns {{ state: "planted"; source: string }}
 */
export function applyToSource(source) {
  const state = plantState(source);
  if (state === "planted") return { state, source };
  if (state !== "healthy") {
    throw new Error(
      "Plant: lib/ledger.ts offset debit does not match the known healthy or planted form. Refusing to edit.",
    );
  }
  return { state: "planted", source: source.replace(healthyDebit, plantedDebit) };
}

/**
 * @param {string} source
 * @returns {{ state: "healthy"; source: string }}
 */
export function revertToSource(source) {
  const state = plantState(source);
  if (state === "healthy") return { state, source };
  if (state !== "planted") {
    throw new Error(
      "Plant: lib/ledger.ts offset debit does not match the known healthy or planted form. Refusing to edit.",
    );
  }
  return { state: "healthy", source: source.replace(plantedDebit, healthyDebit) };
}

/** @param {string} [target] */
export function readTarget(target = defaultTarget) {
  return readFileSync(target, "utf8");
}

/**
 * @param {"apply" | "revert" | "status"} verb
 * @param {{ target?: string }} [options]
 */
export function runPlant(verb, options = {}) {
  const target = options.target ?? defaultTarget;
  const source = readTarget(target);
  if (verb === "status") {
    const state = plantState(source);
    return { ok: true, verb, state, target, changed: false };
  }
  const next =
    verb === "apply" ? applyToSource(source) : revertToSource(source);
  const changed = next.source !== source;
  if (changed) writeFileSync(target, next.source);
  return { ok: true, verb, state: next.state, target, changed };
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const isCli =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const verb = process.argv[2] ?? "status";
  if (verb !== "apply" && verb !== "revert" && verb !== "status") {
    fail('Plant: use apply, revert, or status.');
  }
  try {
    const result = runPlant(verb);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}
