import { type NextRequest, NextResponse } from "next/server";
import {
  DEMO_SCENARIO_COOKIE,
  scenarioFromCookie,
} from "@/lib/demo/scenarios";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import {
  authenticatedResident,
  parsePaymentRequestCommand,
} from "@/lib/server/request";

export async function POST(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json(
      { error: "Sign in to manage payment requests." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a valid payment request." },
      { status: 400 },
    );
  }

  const command = parsePaymentRequestCommand(body);
  if (!command) {
    return NextResponse.json(
      { error: "Enter a valid payment request." },
      { status: 400 },
    );
  }

  const result = await getLedgerRepository().paymentRequest(slug, command, {
    holdReserve:
      scenarioFromCookie(request.cookies.get(DEMO_SCENARIO_COOKIE)?.value) ===
      "debug-mode",
  });
  return NextResponse.json(result, {
    status: result.kind === "ok" ? 200 : 409,
  });
}
