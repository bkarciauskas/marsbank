import { describe, expect, it } from "vitest";
import { lookupPayId } from "./payid";

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
});
