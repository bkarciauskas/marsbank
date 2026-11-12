import { describe, expect, it } from "vitest";
import type { Transaction } from "./domain";
import { seedSnapshotForSlug } from "./fixtures";
import { accountId, contactId, txnId } from "./ids";
import { tokens } from "./money";
import {
  applyContactCommand,
  lookupPayId,
  lookupResidentPayId,
  orderedContacts,
  recentCounterparties,
  suggestedResidentHandles,
} from "./payid";

describe("PayID lookup", () => {
  it("resolves known Cursor and PayID aliases", () => {
    expect(lookupPayId("@cursor")).toEqual({
      kind: "ok",
      payee: {
        scheme: "cursor",
        id: "@cursor",
        displayName: "Cursor",
        institution: "Cursor",
      },
    });
    expect(lookupPayId("Valerie@Valles.mars")).toMatchObject({
      kind: "ok",
      payee: { id: "valerie@valles.mars", scheme: "payid" },
    });
  });

  it("accepts any well-formed Cursor handle or PayID", () => {
    expect(lookupPayId("kevdhan")).toMatchObject({
      kind: "ok",
      payee: { scheme: "cursor", id: "@kevdhan", displayName: "Kevdhan" },
    });
    expect(lookupPayId("ops@habitat.mars")).toMatchObject({
      kind: "ok",
      payee: { scheme: "payid", id: "ops@habitat.mars" },
    });
  });

  it("rejects empty, malformed, and own identifiers", () => {
    expect(lookupPayId("")).toEqual({ kind: "invalid" });
    expect(lookupPayId("??")).toEqual({ kind: "invalid" });
    expect(lookupPayId("cameron@marsbank.mars")).toEqual({ kind: "own" });
    expect(lookupPayId("aaron@marsbank.mars")).toMatchObject({
      kind: "ok",
      payee: { displayName: "Aaron", id: "aaron@marsbank.mars" },
    });
    expect(lookupPayId("cameron@marsbank.mars", "aaron@marsbank.mars")).toMatchObject({
      kind: "ok",
      payee: { displayName: "Cameron" },
    });
  });

  it("resolves another Mars Bank resident by PayID or @slug for payment requests", () => {
    expect(
      lookupResidentPayId("ben@marsbank.mars", "aaron@marsbank.mars"),
    ).toMatchObject({
      kind: "ok",
      resident: { slug: "ben", email: "ben@marsbank.mars" },
      payee: {
        scheme: "payid",
        id: "ben@marsbank.mars",
        displayName: "Ben",
        institution: "Mars Bank",
      },
    });
    expect(lookupResidentPayId("@ben", "aaron@marsbank.mars")).toMatchObject({
      kind: "ok",
      resident: { slug: "ben" },
    });
    expect(lookupResidentPayId("BEN", "aaron@marsbank.mars")).toMatchObject({
      kind: "ok",
      resident: { slug: "ben" },
    });
  });

  it("rejects self, external non-resident handles, and malformed targets for payment requests", () => {
    expect(
      lookupResidentPayId("aaron@marsbank.mars", "aaron@marsbank.mars"),
    ).toEqual({ kind: "own" });
    expect(lookupResidentPayId("@aaron", "aaron@marsbank.mars")).toEqual({
      kind: "own",
    });
    expect(lookupResidentPayId("@cursor", "aaron@marsbank.mars")).toEqual({
      kind: "unknown-resident",
    });
    expect(
      lookupResidentPayId("outsider@earth.org", "aaron@marsbank.mars"),
    ).toEqual({
      kind: "unknown-resident",
    });
    expect(lookupResidentPayId("", "aaron@marsbank.mars")).toEqual({
      kind: "invalid",
    });
    expect(lookupResidentPayId("???", "aaron@marsbank.mars")).toEqual({
      kind: "invalid",
    });
  });

  it("suggests handles for the five other Mars Bank residents", () => {
    const handles = suggestedResidentHandles("aaron@marsbank.mars");
    expect(handles).toHaveLength(5);
    expect(handles.some((entry) => entry.slug === "aaron")).toBe(false);
    expect(handles.some((entry) => entry.handle === "@ben")).toBe(true);
  });
});

describe("saved contacts", () => {
  const now = new Date("2026-11-12T12:00:00.000Z");
  const aaron = seedSnapshotForSlug("aaron");

  function payeeTxn(
    id: string,
    postedOn: string,
    payeeId: string,
    direction: "debit" | "credit" = "debit",
  ): Transaction {
    return {
      id: txnId(id),
      accountId: accountId("acc-everyday"),
      postedOn,
      description: "Counterparty",
      amount: tokens(12),
      direction,
      payee: {
        scheme: payeeId.startsWith("@") ? "cursor" : "payid",
        id: payeeId,
        displayName: payeeId,
        institution: "PayID",
      },
    };
  }

  it("saves a Cursor handle and a PayID with a nickname, then pins it", () => {
    const saved = applyContactCommand(
      aaron,
      { action: "save", command: { handle: "kevdhan", nickname: "  Ridge crew  " } },
      now,
      contactId("contact-ridge"),
    );
    expect(saved.kind).toBe("ok");
    if (saved.kind !== "ok") return;
    expect(saved.contact).toMatchObject({
      id: "contact-ridge",
      nickname: "Ridge crew",
      pinned: false,
      payee: { scheme: "cursor", id: "@kevdhan" },
      savedAt: now.toISOString(),
    });

    const renamed = applyContactCommand(
      saved.snapshot,
      { action: "save", command: { handle: "@kevdhan", nickname: "North Ridge" } },
      now,
      contactId("contact-other"),
    );
    expect(renamed.kind).toBe("ok");
    if (renamed.kind !== "ok") return;
    expect(renamed.snapshot.contacts).toHaveLength(1);
    expect(renamed.contact.id).toBe("contact-ridge");
    expect(renamed.contact.nickname).toBe("North Ridge");

    const pinned = applyContactCommand(
      renamed.snapshot,
      {
        action: "pin",
        command: { contactId: contactId("contact-ridge"), pinned: true },
      },
      now,
      contactId("unused"),
    );
    expect(pinned.kind).toBe("ok");
    if (pinned.kind !== "ok") return;
    expect(pinned.contact.pinned).toBe(true);
    expect(orderedContacts(pinned.snapshot.contacts)[0]?.nickname).toBe(
      "North Ridge",
    );
  });

  it("rejects an empty nickname, a bad handle, and the resident's own PayID", () => {
    expect(
      applyContactCommand(
        aaron,
        { action: "save", command: { handle: "@cursor", nickname: "   " } },
        now,
        contactId("contact-blank"),
      ),
    ).toEqual({ kind: "invalid-nickname" });
    expect(
      applyContactCommand(
        aaron,
        { action: "save", command: { handle: "??", nickname: "Nope" } },
        now,
        contactId("contact-bad"),
      ),
    ).toEqual({ kind: "invalid-payid" });
    expect(
      applyContactCommand(
        aaron,
        {
          action: "save",
          command: { handle: "aaron@marsbank.mars", nickname: "Me" },
        },
        now,
        contactId("contact-self"),
      ),
    ).toEqual({ kind: "own-payid" });
    expect(
      applyContactCommand(
        aaron,
        {
          action: "pin",
          command: { contactId: contactId("contact-missing"), pinned: true },
        },
        now,
        contactId("unused"),
      ),
    ).toEqual({ kind: "unknown-contact" });
  });

  it("lists recent PayID counterparties ahead of older ones, skipping saved contacts", () => {
    const recent = recentCounterparties(
      [
        payeeTxn("older", "2026-11-01T00:00:00.000Z", "ops@habitat.mars"),
        payeeTxn("newer", "2026-11-11T00:00:00.000Z", "@cursor"),
        payeeTxn(
          "incoming",
          "2026-11-10T00:00:00.000Z",
          "ben@marsbank.mars",
          "credit",
        ),
        payeeTxn("self", "2026-11-12T00:00:00.000Z", "aaron@marsbank.mars"),
      ],
      aaron.customer.email,
      [
        {
          id: contactId("contact-cursor"),
          nickname: "Cursor",
          pinned: false,
          savedAt: now.toISOString(),
          payee: {
            scheme: "cursor",
            id: "@cursor",
            displayName: "Cursor",
            institution: "Cursor",
          },
        },
      ],
    );
    expect(recent.map((payee) => payee.id)).toEqual([
      "ben@marsbank.mars",
      "ops@habitat.mars",
    ]);
  });
});
