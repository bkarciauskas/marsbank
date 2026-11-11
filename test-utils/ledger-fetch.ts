import { vi } from "vitest";
import type { BankSnapshot } from "@/lib/domain";
import {
  demoResidents,
  seedSnapshot,
  seedSnapshotForSlug,
} from "@/lib/fixtures";
import { paymentRequestId } from "@/lib/ids";
import { applyPayIdTransfer, applyTransfer, setCardStatus } from "@/lib/ledger";
import { lookupResidentPayId } from "@/lib/payid";
import {
  parseCardUpdate,
  parsePaymentRequestCommand,
  parseTransfer,
} from "@/lib/server/request";
import {
  applyApprovePaymentRequest,
  applyCancelPaymentRequest,
  applyCreatePaymentRequest,
  applyDeclinePaymentRequest,
} from "@/lib/shared-ledger";

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
  const peers = new Map<string, BankSnapshot>();
  let sequence = 0;

  function residentForEmail(email: string) {
    return demoResidents.find(
      (entry) => entry.email.toLowerCase() === email.toLowerCase(),
    );
  }

  function peerSnapshot(slug: string): BankSnapshot {
    const existing = peers.get(slug);
    if (existing) return existing;
    const seeded = structuredClone(seedSnapshotForSlug(slug));
    peers.set(slug, seeded);
    return seeded;
  }

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
    if (url === "/api/requests") {
      const parsed = parsePaymentRequestCommand(bodyFrom(init));
      if (!parsed) return json({ kind: "network" }, 400);
      const actorResident = residentForEmail(snapshot.customer.email);
      if (!actorResident) return json({ kind: "unknown-resident" }, 409);

      if (parsed.action === "create") {
        const lookup = lookupResidentPayId(
          parsed.command.target,
          actorResident.email,
        );
        if (lookup.kind === "invalid") {
          return json({ kind: "invalid-payid" }, 409);
        }
        if (lookup.kind === "own") return json({ kind: "own-payid" }, 409);
        if (lookup.kind === "unknown-resident") {
          return json({ kind: "unknown-resident" }, 409);
        }
        sequence += 1;
        const result = applyCreatePaymentRequest({
          amount: parsed.command.amount,
          description: parsed.command.description,
          id: paymentRequestId(`pr-test-${sequence}`),
          now: new Date(),
          payer: peerSnapshot(lookup.resident.slug),
          payerResident: lookup.resident,
          requester: snapshot,
          requesterResident: actorResident,
        });
        if (result.kind !== "ok") return json(result, 409);
        snapshot = result.actor;
        peers.set(result.counterpartySlug, result.counterparty);
        return json({ kind: "ok", snapshot, request: result.request }, 200);
      }

      const existing = (snapshot.paymentRequests ?? []).find(
        (entry) => entry.id === parsed.command.paymentRequestId,
      );
      if (!existing) return json({ kind: "unknown-request" }, 409);

      const counterpartySlug =
        parsed.action === "cancel"
          ? existing.payerSlug
          : existing.requesterSlug;
      const counterpartyResident = demoResidents.find(
        (entry) => entry.slug === counterpartySlug,
      );
      if (!counterpartyResident) {
        return json({ kind: "unknown-resident" }, 409);
      }

      const result =
        parsed.action === "approve"
          ? applyApprovePaymentRequest({
              command: parsed.command,
              now: new Date(),
              payer: snapshot,
              payerSlug: actorResident.slug,
              requester: peerSnapshot(counterpartySlug),
              requesterResident: counterpartyResident,
            })
          : parsed.action === "decline"
            ? applyDeclinePaymentRequest({
                command: parsed.command,
                now: new Date(),
                payer: snapshot,
                payerSlug: actorResident.slug,
                requester: peerSnapshot(counterpartySlug),
              })
            : applyCancelPaymentRequest({
                command: parsed.command,
                now: new Date(),
                payer: peerSnapshot(counterpartySlug),
                requester: snapshot,
                requesterSlug: actorResident.slug,
              });

      if (result.kind !== "ok") return json(result, 409);
      snapshot = result.actor;
      peers.set(result.counterpartySlug, result.counterparty);
      return json({ kind: "ok", snapshot, request: result.request }, 200);
    }
    if (url === "/api/cards") {
      const update = parseCardUpdate(bodyFrom(init));
      if (!update) return json({ error: "Invalid card state" }, 400);
      snapshot = setCardStatus(snapshot, update.cardId, update.status);
      return json({ snapshot });
    }
    if (url === "/api/reset") {
      snapshot = structuredClone(initial);
      peers.clear();
      return json({ snapshot });
    }
    return json({ error: "Not found" }, 404);
  });
}
