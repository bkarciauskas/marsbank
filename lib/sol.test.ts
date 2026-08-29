import { describe, expect, it } from "vitest";
import { latestPostedTime, solNumberFromLatest, solsBeforeLatest } from "./sol";

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
