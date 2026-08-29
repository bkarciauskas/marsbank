import { type NextRequest, NextResponse } from "next/server";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { authenticatedResident } from "@/lib/server/request";

export async function GET(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json({ error: "Sign in to view a register." }, { status: 401 });
  }

  const snapshot = await getLedgerRepository().getRegister(slug);
  return NextResponse.json({ snapshot });
}
