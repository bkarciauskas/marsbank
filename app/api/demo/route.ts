import { type NextRequest, NextResponse } from "next/server";
import { clearHookStamp } from "@/lib/demo/hook-stamp";
import {
  DEMO_SCENARIO_COOKIE,
  isDemoScenario,
  scenarioFromCookie,
  type DemoScenarioId,
} from "@/lib/demo/scenarios";
import { defaultDemoResident } from "@/lib/fixtures";
import { getLedgerRepository } from "@/lib/server/ledger-repository";

function activeFrom(request: NextRequest): DemoScenarioId | null {
  return scenarioFromCookie(request.cookies.get(DEMO_SCENARIO_COOKIE)?.value);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  };
}

function withScenario(
  response: NextResponse,
  scenario: DemoScenarioId | null,
): NextResponse {
  if (scenario) {
    response.cookies.set(
      DEMO_SCENARIO_COOKIE,
      scenario,
      cookieOptions(60 * 60 * 8),
    );
    return response;
  }
  response.cookies.set(DEMO_SCENARIO_COOKIE, "", cookieOptions(0));
  return response;
}

async function restoreRegisters(): Promise<void> {
  clearHookStamp();
  await getLedgerRepository().resetAll(defaultDemoResident.slug);
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ active: activeFrom(request) });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a demo action." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Choose a demo action." }, { status: 400 });
  }

  const action = "action" in body ? body.action : undefined;
  const scenario = "scenario" in body ? body.scenario : undefined;

  if (action === "reset-all") {
    await restoreRegisters();
    return withScenario(NextResponse.json({ active: null }), null);
  }

  if (action === "setup") {
    if (!isDemoScenario(scenario)) {
      return NextResponse.json({ error: "Choose a demo walk." }, { status: 400 });
    }
    await restoreRegisters();
    return withScenario(NextResponse.json({ active: scenario }), scenario);
  }

  if (action === "reset") {
    if (!isDemoScenario(scenario)) {
      return NextResponse.json({ error: "Choose a demo walk." }, { status: 400 });
    }
    await restoreRegisters();
    const next = activeFrom(request) === scenario ? null : activeFrom(request);
    return withScenario(NextResponse.json({ active: next }), next);
  }

  return NextResponse.json({ error: "Choose a demo action." }, { status: 400 });
}
