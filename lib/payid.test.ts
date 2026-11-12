import { describe, expect, it } from "vitest";
import { seedSnapshotForSlug } from "./fixtures";
import { contactId, txnId, accountId } from "./ids";
import { tokens } from "./money";
import {
  applyContactCommand,
  contactsForPicker,
  lookupPayId,
  lookupResidentPayId,
  recentPayeeCounterparties,
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
    expect(
      lookupPayId("cameron@marsbank.mars", "aaron@marsbank.mars"),
    ).toMatchObject({
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
  const owner = "aaron@marsbank.mars";
  const issued = {
    id: contactId("ct-cursor"),
    savedAt: "2026-11-01T00:00:00.000Z",
  };

  function save(
    snapshot = seedSnapshotForSlug("aaron"),
    nickname = "Cursor desk",
    handle = "@cursor",
    id = issued.id,
    savedAt = issued.savedAt,
  ) {
    return applyContactCommand(
      snapshot,
      owner,
      { action: "save", command: { handle, nickname } },
      { id, savedAt },
    );
  }

  it("saves a Cursor handle or PayID under a nickname and keeps the pin on a later save", () => {
    const saved = save();
    expect(saved.kind).toBe("ok");
    if (saved.kind !== "ok") return;
    expect(saved.contact).toMatchObject({
      id: "ct-cursor",
      nickname: "Cursor desk",
      pinned: false,
      payee: { scheme: "cursor", id: "@cursor", displayName: "Cursor" },
    });

    const pinned = applyContactCommand(
      saved.snapshot,
      owner,
      { action: "pin", command: { contactId: saved.contact.id, pinned: true } },
      { id: contactId("ct-unused"), savedAt: "2026-11-02T00:00:00.000Z" },
    );
    expect(pinned.kind).toBe("ok");
    if (pinned.kind !== "ok") return;

    const renamed = applyContactCommand(
      pinned.snapshot,
      owner,
      {
        action: "save",
        command: { handle: "cursor", nickname: "  Habitat crew  " },
      },
      { id: contactId("ct-other"), savedAt: "2026-11-03T00:00:00.000Z" },
    );
    expect(renamed.kind).toBe("ok");
    if (renamed.kind !== "ok") return;
    expect(renamed.contact).toMatchObject({
      id: "ct-cursor",
      nickname: "Habitat crew",
      pinned: true,
    });
    expect(renamed.snapshot.contacts).toHaveLength(1);
    expect(contactsForPicker(renamed.snapshot.contacts)[0]?.nickname).toBe(
      "Habitat crew",
    );
  });

  it("rejects a blank nickname, an own identity, and a missing contact", () => {
    expect(save(undefined, "   ").kind).toBe("invalid-nickname");
    expect(save(undefined, "A".repeat(41)).kind).toBe("invalid-nickname");
    expect(save(seedSnapshotForSlug("aaron"), "Me", "@aaron").kind).toBe(
      "own-payid",
    );
    expect(save(seedSnapshotForSlug("aaron"), "Nope", "??").kind).toBe(
      "invalid-payid",
    );
    expect(
      applyContactCommand(
        seedSnapshotForSlug("aaron"),
        owner,
        {
          action: "pin",
          command: { contactId: contactId("ct-missing"), pinned: true },
        },
        issued,
      ),
    ).toEqual({ kind: "unknown-contact" });
  });

  it("lists pinned contacts first and recent debit payees that are not saved", () => {
    const saved = save(
      seedSnapshotForSlug("aaron"),
      "Ben",
      "ben@marsbank.mars",
      contactId("ct-ben"),
      "2026-11-02T00:00:00.000Z",
    );
    if (saved.kind !== "ok") return;
    const second = applyContactCommand(
      saved.snapshot,
      owner,
      {
        action: "save",
        command: { handle: "@cursor", nickname: "Cursor desk" },
      },
      { id: contactId("ct-cursor"), savedAt: "2026-10-01T00:00:00.000Z" },
    );
    if (second.kind !== "ok") return;
    const pinned = applyContactCommand(
      second.snapshot,
      owner,
      {
        action: "pin",
        command: { contactId: contactId("ct-cursor"), pinned: true },
      },
      issued,
    );
    if (pinned.kind !== "ok") return;

    expect(
      contactsForPicker(pinned.snapshot.contacts).map(
        (contact) => contact.nickname,
      ),
    ).toEqual(["Cursor desk", "Ben"]);

    const base = seedSnapshotForSlug("aaron");
    const recent = recentPayeeCounterparties(
      [
        {
          id: txnId("txn-in"),
          accountId: accountId("acc-everyday"),
          postedOn: "2026-11-02T00:00:00.000Z",
          description: "Incoming",
          amount: tokens(10),
          direction: "credit",
          payee: {
            scheme: "payid",
            id: "robin@marsbank.mars",
            displayName: "Robin",
            institution: "Mars Bank",
          },
        },
        {
          id: txnId("txn-out-new"),
          accountId: accountId("acc-everyday"),
          postedOn: "2026-11-03T00:00:00.000Z",
          description: "Ops",
          amount: tokens(20),
          direction: "debit",
          payee: {
            scheme: "payid",
            id: "ops@habitat.mars",
            displayName: "Ops",
            institution: "PayID",
          },
        },
        {
          id: txnId("txn-out-saved"),
          accountId: accountId("acc-everyday"),
          postedOn: "2026-11-04T00:00:00.000Z",
          description: "Cursor",
          amount: tokens(30),
          direction: "debit",
          payee: {
            scheme: "cursor",
            id: "@cursor",
            displayName: "Cursor",
            institution: "Cursor",
          },
        },
      ],
      pinned.snapshot.contacts,
    );
    expect(recent.map((payee) => payee.id)).toEqual(["ops@habitat.mars"]);
    expect(base.contacts).toEqual([]);
  });
});
