// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { GET } from "./route";

describe("register route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("cameron");
  });

  it("returns the register selected by the session cookie", async () => {
    const request = new NextRequest("http://localhost/api/register", {
      headers: { cookie: "marsbank-demo-session=aaron" },
    });
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      snapshot: {
        customer: { email: "aaron@marsbank.mars" },
      },
    });
  });

  it("rejects requests without a demo session", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/register"),
    );
    expect(response.status).toBe(401);
  });
});
