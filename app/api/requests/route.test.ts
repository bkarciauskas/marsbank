// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as resetPost } from "@/app/api/reset/route";
import { availableBalance } from "@/lib/ledger";
import { openIncomingRequests, outgoingRequests } from "@/lib/notifications";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { POST } from "./route";

function request(body: unknown, cookie = "marsbank-demo-session=aaron") {
  return new NextRequest("http://localhost/api/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

describe("payment requests route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("aaron");
  });

  it("creates a request by @slug or PayID and surfaces it on both registers", async () => {
    const createRes = await POST(
      request({
        action: "create",
        target: "@ben",
        amount: 1_800,
        description: "Arc Canteen tray",
      }),
    );

    expect(createRes.status).toBe(200);
    const createdPayload = (await createRes.json()) as {
      kind: string;
      request: { id: string; status: string; amount: number; description: string };
    };
    expect(createdPayload.kind).toBe("ok");
    expect(createdPayload.request).toMatchObject({
      amount: 1_800,
      description: "Arc Canteen tray",
      status: "open",
    });

    const aaron = await getLedgerRepository().getRegister("aaron");
    const ben = await getLedgerRepository().getRegister("ben");
    expect(outgoingRequests(aaron)).toHaveLength(1);
    expect(openIncomingRequests(ben)).toHaveLength(1);

    const byPayId = await POST(
      request({
        action: "create",
        target: "robin@marsbank.mars",
        amount: 2_400,
        description: "Rover hire split",
      }),
    );
    expect(byPayId.status).toBe(200);
    const robin = await getLedgerRepository().getRegister("robin");
    expect(openIncomingRequests(robin)[0]).toMatchObject({
      amount: 2_400,
      requesterSlug: "aaron",
      payerSlug: "robin",
    });
  });

  it("rejects self-requests, external non-residents, invalid PayIDs, and non-positive or fractional amounts", async () => {
    const selfByHandle = await POST(
      request({
        action: "create",
        target: "@aaron",
        amount: 500,
        description: "Self",
      }),
    );
    expect(selfByHandle.status).toBe(409);
    expect(await selfByHandle.json()).toEqual({ kind: "own-payid" });

    const selfByEmail = await POST(
      request({
        action: "create",
        target: "aaron@marsbank.mars",
        amount: 500,
        description: "Self",
      }),
    );
    expect(selfByEmail.status).toBe(409);
    expect(await selfByEmail.json()).toEqual({ kind: "own-payid" });

    const external = await POST(
      request({
        action: "create",
        target: "@cursor",
        amount: 500,
        description: "External",
      }),
    );
    expect(external.status).toBe(409);
    expect(await external.json()).toEqual({ kind: "unknown-resident" });

    const malformedTarget = await POST(
      request({
        action: "create",
        target: "???",
        amount: 500,
        description: "Bad",
      }),
    );
    expect(malformedTarget.status).toBe(409);
    expect(await malformedTarget.json()).toEqual({ kind: "invalid-payid" });

    const zeroAmount = await POST(
      request({
        action: "create",
        target: "@ben",
        amount: 0,
        description: "Zero",
      }),
    );
    expect(zeroAmount.status).toBe(409);
    expect(await zeroAmount.json()).toEqual({ kind: "amount-not-positive" });

    const fractional = await POST(
      request({
        action: "create",
        target: "@ben",
        amount: 12.5,
        description: "Fraction",
      }),
    );
    expect(fractional.status).toBe(400);

    const unauthenticated = await POST(
      request(
        {
          action: "create",
          target: "@ben",
          amount: 100,
          description: "Anon",
        },
        "",
      ),
    );
    expect(unauthenticated.status).toBe(401);
  });

  it("approves an open request, enforcing step-up confirmation and the 250,000 MT sol cap", async () => {
    const firstCreate = await POST(
      request({
        action: "create",
        target: "ben@marsbank.mars",
        amount: 200_000,
        description: "Habitat solar rig",
      }),
    );
    const { request: req1 } = (await firstCreate.json()) as {
      request: { id: string };
    };

    const secondCreate = await POST(
      request({
        action: "create",
        target: "ben@marsbank.mars",
        amount: 60_000,
        description: "Battery pack",
      }),
    );
    const { request: req2 } = (await secondCreate.json()) as {
      request: { id: string };
    };

    const missingStepUp = await POST(
      request(
        {
          action: "approve",
          paymentRequestId: req1.id,
          from: "acc-everyday",
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(missingStepUp.status).toBe(409);
    expect(await missingStepUp.json()).toEqual({ kind: "step-up-required" });

    const spoofedStepUp = await POST(
      request(
        {
          action: "approve",
          paymentRequestId: req1.id,
          from: "acc-everyday",
          stepUpConfirmed: "yes",
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(spoofedStepUp.status).toBe(409);
    expect(await spoofedStepUp.json()).toEqual({ kind: "step-up-required" });

    const approved = await POST(
      request(
        {
          action: "approve",
          paymentRequestId: req1.id,
          from: "acc-everyday",
          stepUpConfirmed: true,
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(approved.status).toBe(200);

    const benAfterFirst = await getLedgerRepository().getRegister("ben");
    const aaronAfterFirst = await getLedgerRepository().getRegister("aaron");
    const benSol = benAfterFirst.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    const aaronSol = aaronAfterFirst.accounts.find(
      (account) => account.id === "acc-everyday",
    );
    expect(benSol && availableBalance(benSol)).toBe(1_000_112_750);
    expect(aaronSol && availableBalance(aaronSol)).toBe(1_000_296_410);

    const duplicateApprove = await POST(
      request(
        {
          action: "approve",
          paymentRequestId: req1.id,
          from: "acc-everyday",
          stepUpConfirmed: true,
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(duplicateApprove.status).toBe(409);
    expect(await duplicateApprove.json()).toEqual({ kind: "request-not-open" });

    const overSolLimit = await POST(
      request(
        {
          action: "approve",
          paymentRequestId: req2.id,
          from: "acc-everyday",
          stepUpConfirmed: true,
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(overSolLimit.status).toBe(409);
    expect(await overSolLimit.json()).toEqual({ kind: "sol-limit" });
    expect(
      openIncomingRequests(await getLedgerRepository().getRegister("ben")).map(
        (entry) => entry.id,
      ),
    ).toEqual([req2.id]);
  });

  it("declines an incoming request, cancels an outgoing request, and clears all requests on demo reset", async () => {
    const first = await POST(
      request({
        action: "create",
        target: "@ben",
        amount: 900,
        description: "Coffee run",
      }),
    );
    const { request: toDecline } = (await first.json()) as {
      request: { id: string };
    };

    const second = await POST(
      request({
        action: "create",
        target: "@ben",
        amount: 1_500,
        description: "Greenhouse greens",
      }),
    );
    const { request: toCancel } = (await second.json()) as {
      request: { id: string };
    };

    const declined = await POST(
      request(
        {
          action: "decline",
          paymentRequestId: toDecline.id,
        },
        "marsbank-demo-session=ben",
      ),
    );
    expect(declined.status).toBe(200);

    const cancelled = await POST(
      request({
        action: "cancel",
        paymentRequestId: toCancel.id,
      }),
    );
    expect(cancelled.status).toBe(200);

    const aaronBeforeReset = await getLedgerRepository().getRegister("aaron");
    const benBeforeReset = await getLedgerRepository().getRegister("ben");
    expect(openIncomingRequests(benBeforeReset)).toHaveLength(0);
    expect(
      outgoingRequests(aaronBeforeReset).map((entry) => entry.status).sort(),
    ).toEqual(["cancelled", "declined"]);

    const resetRes = await resetPost(
      new NextRequest("http://localhost/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "marsbank-demo-session=aaron",
        },
        body: JSON.stringify({ confirmation: "RESET ALL REGISTERS" }),
      }),
    );
    expect(resetRes.status).toBe(200);

    const aaronAfterReset = await getLedgerRepository().getRegister("aaron");
    const benAfterReset = await getLedgerRepository().getRegister("ben");
    expect(aaronAfterReset.paymentRequests).toEqual([]);
    expect(benAfterReset.paymentRequests).toEqual([]);
  });
});
