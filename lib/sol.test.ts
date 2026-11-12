import { describe, expect, it } from "vitest";
import {
  latestPostedTime,
  solIndex,
  solNumberFromLatest,
  solsBeforeLatest,
  utcSol,
} from "./sol";

describe("ledger sol numbering", () => {
  it("keeps Sol 21 as the latest posted earth-day", () => {
    const latest = latestPostedTime([
      "2026-08-25T11:20:00.000Z",
      "2026-08-24T08:00:00.000Z",
    ]);

    expect(solNumberFromLatest("2026-08-25T11:20:00.000Z", latest)).toBe(21);
    expect(solNumberFromLatest("2026-08-24T08:00:00.000Z", latest)).toBe(20);
    expect(solsBeforeLatest("2026-08-25T11:20:00.000Z", latest)).toBe(0);
  });
});

describe("solIndex", () => {
  it("rolls to the next sol at 00:00 UTC", () => {
    const last = solIndex(Date.parse("2026-08-26T23:59:59.999Z"));

    expect(solIndex(Date.parse("2026-08-26T00:00:00.000Z"))).toBe(last);
    expect(solIndex(Date.parse("2026-08-27T00:00:00.000Z"))).toBe(last + 1);
  });
});

describe("utcSol", () => {
  it("bounds the earth-day that contains a UTC instant", () => {
    const midday = Date.parse("2026-08-26T12:00:00.000Z");
    const sol = utcSol(midday);

    expect(sol.index).toBe(solIndex(midday));
    expect(sol.startsAt).toBe(Date.parse("2026-08-26T00:00:00.000Z"));
    expect(sol.endsAt).toBe(Date.parse("2026-08-27T00:00:00.000Z"));
    expect(utcSol(sol.endsAt).index).toBe(sol.index + 1);
    expect(utcSol(sol.endsAt - 1).index).toBe(sol.index);
  });
});
