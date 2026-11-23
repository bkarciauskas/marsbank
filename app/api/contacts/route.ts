import { type NextRequest, NextResponse } from "next/server";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import {
  authenticatedResident,
  parseContactCommand,
} from "@/lib/server/request";

export async function POST(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json(
      { error: "Sign in to save a contact." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Enter a valid contact." },
      { status: 400 },
    );
  }

  const command = parseContactCommand(body);
  if (!command) {
    return NextResponse.json(
      { error: "Enter a valid contact." },
      { status: 400 },
    );
  }

  const result = await getLedgerRepository().contact(slug, command);
  return NextResponse.json(result, {
    status: result.kind === "ok" ? 200 : 409,
  });
}
