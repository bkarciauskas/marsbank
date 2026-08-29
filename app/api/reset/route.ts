import { type NextRequest, NextResponse } from "next/server";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { authenticatedResident } from "@/lib/server/request";

const confirmation = "RESET ALL REGISTERS";

export async function POST(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json(
      { error: "Sign in to restore the demo." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Confirm the demo reset." }, { status: 400 });
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("confirmation" in body) ||
    body.confirmation !== confirmation
  ) {
    return NextResponse.json({ error: "Confirm the demo reset." }, { status: 400 });
  }

  const snapshot = await getLedgerRepository().resetAll(slug);
  return NextResponse.json({ snapshot });
}
