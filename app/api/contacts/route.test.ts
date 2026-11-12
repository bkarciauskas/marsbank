// @vitest-environment node

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as resetPost } from "@/app/api/reset/route";
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

  it("saves a PayID or Cursor handle with a nickname and pins it", async () => {
    const savedRes = await POST(
      request({
        action: "save",
        handle: "@cursor",
        nickname: "Cursor desk",
      }),
    );
    expect(savedRes.status).toBe(200);
    const saved = (await savedRes.json()) as {
      kind: string;
      contact: {
        id: string;
        nickname: string;
        pinned: boolean;
        payee: { id: string };
      };
    };
    expect(saved.kind).toBe("ok");
    expect(saved.contact).toMatchObject({
      nickname: "Cursor desk",
      pinned: false,
      payee: { id: "@cursor", scheme: "cursor" },
    });

    const pinnedRes = await POST(
      request({
        action: "pin",
        contactId: saved.contact.id,
        pinned: true,
      }),
    );
    expect(pinnedRes.status).toBe(200);
    const pinned = (await pinnedRes.json()) as {
      contact: { pinned: boolean; nickname: string };
    };
    expect(pinned.contact).toMatchObject({
      nickname: "Cursor desk",
      pinned: true,
    });

    const aaron = await getLedgerRepository().getRegister("aaron");
    expect(aaron.contacts).toHaveLength(1);
    expect(aaron.contacts[0]?.pinned).toBe(true);

    const payId = await POST(
      request({
        action: "save",
        handle: "ops@habitat.mars",
        nickname: "Habitat ops",
      }),
    );
    expect(payId.status).toBe(200);
    expect(
      (await getLedgerRepository().getRegister("aaron")).contacts,
    ).toHaveLength(2);
    expect((await getLedgerRepository().getRegister("ben")).contacts).toEqual(
      [],
    );
  });

  it("rejects own identities, blank nicknames, malformed bodies, and signed-out callers", async () => {
    const own = await POST(
      request({ action: "save", handle: "@aaron", nickname: "Me" }),
    );
    expect(own.status).toBe(409);
    expect(await own.json()).toEqual({ kind: "own-payid" });

    const blank = await POST(
      request({ action: "save", handle: "@cursor", nickname: "   " }),
    );
    expect(blank.status).toBe(409);
    expect(await blank.json()).toEqual({ kind: "invalid-nickname" });

    const malformed = await POST(
      request({ action: "save", handle: "??", nickname: "Nope" }),
    );
    expect(malformed.status).toBe(409);
    expect(await malformed.json()).toEqual({ kind: "invalid-payid" });

    const missing = await POST(
      request({ action: "pin", contactId: "ct-missing", pinned: true }),
    );
    expect(missing.status).toBe(409);
    expect(await missing.json()).toEqual({ kind: "unknown-contact" });

    const badBody = await POST(request({ action: "save" }));
    expect(badBody.status).toBe(400);

    const unauthenticated = await POST(
      request(
        { action: "save", handle: "@cursor", nickname: "Cursor desk" },
        "",
      ),
    );
    expect(unauthenticated.status).toBe(401);
  });

  it("restores an empty contact directory on demo reset", async () => {
    const saved = await POST(
      request({ action: "save", handle: "@ben", nickname: "Ben" }),
    );
    expect(saved.status).toBe(200);

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
    expect((await getLedgerRepository().getRegister("aaron")).contacts).toEqual(
      [],
    );
  });
});
