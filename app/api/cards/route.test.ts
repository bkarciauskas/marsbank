// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { PATCH } from "./route";

describe("cards route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("cameron");
  });

  it("updates a card for the signed-in resident", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/cards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "marsbank-demo-session=cameron",
        },
        body: JSON.stringify({
          cardId: "card-everyday",
          status: "frozen",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      snapshot: {
        cards: expect.arrayContaining([
          expect.objectContaining({
            id: "card-everyday",
            status: "frozen",
          }),
        ]),
      },
    });
  });

  it("rejects an invalid card state", async () => {
    const response = await PATCH(
      new NextRequest("http://localhost/api/cards", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: "marsbank-demo-session=cameron",
        },
        body: JSON.stringify({
          cardId: "card-everyday",
          status: "lost",
        }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
