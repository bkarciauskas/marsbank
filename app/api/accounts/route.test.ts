// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { registerPosition } from "@/lib/ledger";
import { POST } from "./route";

function request(body: unknown, cookie = "marsbank-demo-session=aaron") {
  return new NextRequest("http://localhost/api/accounts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const vault = {
  kind: "savings",
  name: "Launch Window Cargo Reserve",
  goal: 120_000,
};

describe("accounts route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("aaron");
  });

  it("opens an empty vault with a server-minted id and keeps it until reset", async () => {
    const before = await getLedgerRepository().getRegister("aaron");

    const response = await POST(
      request({
        ...vault,
        id: "acc-everyday",
        available: 9_000_000,
        current: 9_000_000,
      }),
    );

    expect(response.status).toBe(200);
    expect(((await response.json()) as { kind: string }).kind).toBe("ok");
    const aaron = await getLedgerRepository().getRegister("aaron");
    const opened = aaron.accounts.find(
      (account) => account.name === "Launch Window Cargo Reserve",
    );
    expect(opened).toMatchObject({
      kind: "savings",
      available: 0,
      current: 0,
      goal: 120_000,
    });
    expect(opened?.id).toMatch(/^acc-[0-9a-f-]{36}$/);
    expect(
      aaron.accounts.filter((account) => account.id === "acc-everyday"),
    ).toHaveLength(1);
    expect(registerPosition(aaron.accounts)).toEqual(
      registerPosition(before.accounts),
    );

    await getLedgerRepository().resetAll("aaron");
    expect(await getLedgerRepository().getRegister("aaron")).toEqual(before);
  });

  it("opens an offset bucket linked to the resident's habitat loan", async () => {
    const response = await POST(
      request({
        kind: "offset",
        name: "Dust Storm Buffer",
        goal: 50_000,
        linkedLoanId: "acc-habitat-loan",
      }),
    );

    expect(response.status).toBe(200);
    const aaron = await getLedgerRepository().getRegister("aaron");
    expect(
      aaron.accounts.find((account) => account.name === "Dust Storm Buffer"),
    ).toMatchObject({ kind: "offset", linkedLoanId: "acc-habitat-loan" });
  });

  it("answers a broken domain rule with its typed reason", async () => {
    const open = async (body: unknown) => {
      const response = await POST(request(body));
      return { status: response.status, body: await response.json() };
    };

    expect(await open({ ...vault, name: "   " })).toEqual({
      status: 409,
      body: { kind: "name-empty" },
    });
    expect(await open({ ...vault, name: "x".repeat(41) })).toEqual({
      status: 409,
      body: { kind: "name-too-long" },
    });
    expect(await open({ ...vault, goal: 0 })).toEqual({
      status: 409,
      body: { kind: "goal-not-positive" },
    });
    expect(
      await open({ ...vault, kind: "offset", linkedLoanId: "acc-everyday" }),
    ).toEqual({ status: 409, body: { kind: "unknown-loan" } });
  });

  it("rejects malformed, fractional, and unauthenticated requests", async () => {
    const before = await getLedgerRepository().getRegister("aaron");

    expect((await POST(request("not json"))).status).toBe(400);
    expect((await POST(request({ kind: "savings" }))).status).toBe(400);
    expect((await POST(request({ ...vault, kind: "loan" }))).status).toBe(400);
    expect((await POST(request({ ...vault, goal: 1.5 }))).status).toBe(400);
    expect((await POST(request({ ...vault, goal: "100" }))).status).toBe(400);
    expect((await POST(request({ ...vault, kind: "offset" }))).status).toBe(400);
    expect((await POST(request(vault, ""))).status).toBe(401);

    expect(await getLedgerRepository().getRegister("aaron")).toEqual(before);
  });
});
