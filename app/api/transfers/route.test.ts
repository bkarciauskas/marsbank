// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { availableBalance } from "@/lib/ledger";
import { POST } from "./route";

function request(body: unknown, cookie = "marsbank-demo-session=aaron") {
  return new NextRequest("http://localhost/api/transfers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

describe("transfers route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("aaron");
  });

  it("moves tokens between the cookie resident and a Mars Bank payee", async () => {
    const response = await POST(
      request({
        requestId: "route-transfer-001",
        kind: "payid",
        from: "acc-everyday",
        amount: 10_000,
        description: "Shared supplies",
        payee: {
          scheme: "payid",
          id: "ben@marsbank.mars",
          displayName: "Ben",
          institution: "Mars Bank",
        },
      }),
    );

    expect(response.status).toBe(200);
    const ben = await getLedgerRepository().getRegister("ben");
    const sol = ben.accounts.find((account) => account.id === "acc-everyday");
    expect(sol && availableBalance(sol)).toBe(1_000_322_750);
  });

  it("holds reserve available when the debug-mode walk is staged", async () => {
    const response = await POST(
      request(
        {
          requestId: "route-debug-hold-001",
          kind: "own",
          from: "acc-everyday",
          to: "acc-reserve",
          amount: 50_000,
          description: "Reserve contribution",
        },
        "marsbank-demo-session=aaron; marsbank-demo-scenario=debug-mode",
      ),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      kind: string;
      snapshot: {
        accounts: { id: string; available: number; current: number }[];
      };
    };
    const reserve = payload.snapshot.accounts.find(
      (account) => account.id === "acc-reserve",
    );
    expect(reserve?.available).toBe(2_002_410_000);
    expect(reserve?.current).toBe(2_002_460_000);
  });

  it("rejects malformed and unauthenticated transfers", async () => {
    expect((await POST(request({ kind: "payid" }))).status).toBe(400);
    expect(
      (
        await POST(
          request(
            {
              requestId: "route-transfer-002",
              kind: "own",
              from: "acc-everyday",
              to: "acc-reserve",
              amount: 1,
              description: "",
            },
            "",
          ),
        )
      ).status,
    ).toBe(401);
  });
});
