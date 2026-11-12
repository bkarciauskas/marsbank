// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { getLedgerRepository } from "@/lib/server/ledger-repository";
import { POST } from "./route";

function request(body: unknown, cookie = "marsbank-demo-session=aaron") {
  return new NextRequest("http://localhost/api/contacts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie,
    },
    body: JSON.stringify(body),
  });
}

describe("contacts route", () => {
  beforeEach(async () => {
    await getLedgerRepository().resetAll("aaron");
  });

  it("saves a PayID with a nickname and pins it for the signed-in resident", async () => {
    const saved = await POST(
      request({
        action: "save",
        handle: "ops@habitat.mars",
        nickname: "Habitat ops",
      }),
    );
    expect(saved.status).toBe(200);
    const payload = (await saved.json()) as {
      kind: string;
      contact: { id: string; nickname: string; payee: { id: string } };
    };
    expect(payload.kind).toBe("ok");
    expect(payload.contact).toMatchObject({
      nickname: "Habitat ops",
      payee: { id: "ops@habitat.mars", scheme: "payid" },
    });

    const pinned = await POST(
      request({
        action: "pin",
        contactId: payload.contact.id,
        pinned: true,
      }),
    );
    expect(pinned.status).toBe(200);
    const aaron = await getLedgerRepository().getRegister("aaron");
    expect(aaron.contacts).toEqual([
      expect.objectContaining({
        nickname: "Habitat ops",
        pinned: true,
      }),
    ]);
    expect((await getLedgerRepository().getRegister("ben")).contacts).toEqual(
      [],
    );
  });

  it("rejects a signed-out resident, a bad body, and an unsavable handle", async () => {
    const signedOut = await POST(
      new NextRequest("http://localhost/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          handle: "@cursor",
          nickname: "Cursor",
        }),
      }),
    );
    expect(signedOut.status).toBe(401);

    const malformed = await POST(
      new NextRequest("http://localhost/api/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: "marsbank-demo-session=aaron",
        },
        body: "{",
      }),
    );
    expect(malformed.status).toBe(400);

    const missing = await POST(request({ action: "save", handle: "@cursor" }));
    expect(missing.status).toBe(400);

    const own = await POST(
      request({
        action: "save",
        handle: "@aaron",
        nickname: "Me",
      }),
    );
    expect(own.status).toBe(409);
    expect(await own.json()).toEqual({ kind: "own-payid" });

    const unknown = await POST(
      request({
        action: "pin",
        contactId: "contact-missing",
        pinned: true,
      }),
    );
    expect(unknown.status).toBe(409);
    expect(await unknown.json()).toEqual({ kind: "unknown-contact" });
  });
});
