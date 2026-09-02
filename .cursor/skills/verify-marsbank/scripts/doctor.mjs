#!/usr/bin/env node
import {
  fail,
  fetchText,
  listeningPids,
  loadInstance,
  pidAlive,
} from "./lib.mjs";

const instance = loadInstance();
if (!instance) {
  fail(
    "Doctor: no instance file at .cursor/skills/verify-marsbank/.run/instance.json. Launch with scripts/launch.mjs first.",
  );
}

const problems = [];

if (!pidAlive(instance.pid)) {
  problems.push(`recorded pid ${instance.pid} is not running`);
}

const occupants = listeningPids(instance.port);
if (occupants.length === 0) {
  // lsof/netstat can be missing or hide a listener; HTTP below is the source of truth.
} else if (
  !occupants.includes(instance.pid) &&
  !occupants.some((pid) => pidAlive(pid))
) {
  problems.push(
    `port ${instance.port} listeners ${occupants.join(", ")} do not include recorded pid ${instance.pid}`,
  );
}

const loginUrl = `${instance.baseUrl}/login`;
let login;
try {
  login = await fetchText(loginUrl);
} catch (error) {
  problems.push(`GET ${loginUrl} failed: ${error instanceof Error ? error.message : error}`);
}

if (login) {
  if (login.response.status !== 200) {
    problems.push(`GET ${loginUrl} returned HTTP ${login.response.status}`);
  }
  if (!login.body.includes("Enter Mars Bank")) {
    problems.push("login HTML is missing the Enter Mars Bank submit control");
  }
  if (!login.body.includes("Demo resident")) {
    problems.push("login HTML is missing the Demo resident roster");
  }
}

const registerUrl = `${instance.baseUrl}/api/register`;
let register;
try {
  register = await fetchText(registerUrl);
} catch (error) {
  problems.push(`GET ${registerUrl} failed: ${error instanceof Error ? error.message : error}`);
}

if (register) {
  if (register.response.status !== 401) {
    problems.push(
      `unauthenticated GET ${registerUrl} should be 401, got ${register.response.status}`,
    );
  }
  if (!register.body.includes("Sign in to view a register")) {
    problems.push("unauthenticated register response is missing the expected error copy");
  }
}

if (problems.length > 0) {
  fail(`Doctor failed for ${instance.baseUrl} (runId ${instance.runId}):\n- ${problems.join("\n- ")}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      runId: instance.runId,
      pid: instance.pid,
      baseUrl: instance.baseUrl,
      login: loginUrl,
      unauthenticatedRegister: { status: register.response.status },
    },
    null,
    2,
  ),
);
