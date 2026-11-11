import { describe, expect, it } from "vitest";
import {
  lookupPayId,
  lookupResidentPayId,
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
