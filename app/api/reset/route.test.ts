// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { accountId } from "@/lib/ids";
import { tokens } from "@/lib/money";
import { POST } from "./route";

function request(confirmation: string) {
  return new NextRequest("http://localhost/api/reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "marsbank-demo-session=aaron",
    },
    body: JSON.stringify({ confirmation }),
  });
}

describe("reset route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("aaron");
  });

  it("restores all registers after explicit confirmation", async () => {
    await getLedgerRepository().transfer("aaron", "reset-route-transfer", {
      kind: "own",
      command: {
        from: accountId("acc-everyday"),
        to: accountId("acc-reserve"),
        amount: tokens(10_000),
        description: "",
      },
    });

    const response = await POST(request("RESET ALL REGISTERS"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      snapshot: {
        customer: { displayName: "Aaron" },
        accounts: expect.arrayContaining([
          expect.objectContaining({
            id: "acc-everyday",
            available: 96_410,
          }),
        ]),
      },
    });
  });

  it("rejects a reset without the confirmation phrase", async () => {
    expect((await POST(request("reset"))).status).toBe(400);
  });
});
