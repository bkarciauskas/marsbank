import { type NextRequest, NextResponse } from "next/server";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import {
  authenticatedResident,
  parseCardUpdate,
} from "@/lib/server/request";

export async function PATCH(request: NextRequest) {
  const slug = authenticatedResident(request);
  if (!slug) {
    return NextResponse.json(
      { error: "Sign in to manage cards." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Choose a valid card state." }, { status: 400 });
  }
  const update = parseCardUpdate(body);
  if (!update) {
    return NextResponse.json({ error: "Choose a valid card state." }, { status: 400 });
  }

  const snapshot = await getLedgerRepository().updateCardStatus(
    slug,
    update.cardId,
    update.status,
  );
  return NextResponse.json({ snapshot });
}
