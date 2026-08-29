import { vi } from "vitest";
import type { BankSnapshot } from "@/lib/domain";
import { seedSnapshot } from "@/lib/fixtures";
import { applyPayIdTransfer, applyTransfer, setCardStatus } from "@/lib/ledger";
import { parseCardUpdate, parseTransfer } from "@/lib/server/request";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function bodyFrom(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") return undefined;
  return JSON.parse(init.body);
}

export function createLedgerFetch(
  initial: BankSnapshot = seedSnapshot,
): typeof fetch {
  let snapshot = structuredClone(initial);

  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.pathname
          : new URL(input.url).pathname;

    if (url === "/api/register") {
      return json({ snapshot });
    }
    if (url === "/api/transfers") {
      const transfer = parseTransfer(bodyFrom(init));
      if (!transfer) return json({ kind: "network" }, 400);
      const result =
        transfer.command.kind === "own"
          ? applyTransfer(snapshot, transfer.command.command)
          : applyPayIdTransfer(snapshot, transfer.command.command);
      if (result.kind === "ok") snapshot = result.snapshot;
      return json(result, result.kind === "ok" ? 200 : 409);
    }
    if (url === "/api/cards") {
      const update = parseCardUpdate(bodyFrom(init));
      if (!update) return json({ error: "Invalid card state" }, 400);
      snapshot = setCardStatus(snapshot, update.cardId, update.status);
      return json({ snapshot });
    }
    if (url === "/api/reset") {
      snapshot = structuredClone(initial);
      return json({ snapshot });
    }
    return json({ error: "Not found" }, 404);
  });
}
