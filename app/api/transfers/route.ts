import { type NextRequest, NextResponse } from "next/server";
import {
  DEMO_SCENARIO_COOKIE,
  scenarioFromCookie,
} from "@/lib/demo/scenarios";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import {
  authenticatedResident,
  parseTransfer,
} from "@/lib/server/request";

export async function POST(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json({ error: "Sign in to send tokens." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid transfer." }, { status: 400 });
  }

  const transfer = parseTransfer(body);
  if (!transfer) {
    return NextResponse.json({ error: "Enter a valid transfer." }, { status: 400 });
  }

  const result = await getLedgerRepository().transfer(
    slug,
    transfer.requestId,
    transfer.command,
    {
      holdReserve:
        scenarioFromCookie(request.cookies.get(DEMO_SCENARIO_COOKIE)?.value) ===
        "debug-mode",
    },
  );
  return NextResponse.json(
    result,
    { status: result.kind === "ok" ? 200 : 409 },
  );
}
