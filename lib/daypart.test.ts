import { describe, expect, it } from "vitest";
import { formatDaypartGreeting } from "./daypart";

describe("daypart greeting", () => {
  it.each([
    ...Array.from({ length: 12 }, (_, hour) => [hour, "morning"] as const),
    ...Array.from({ length: 5 }, (_, offset) => [offset + 12, "afternoon"] as const),
    ...Array.from({ length: 7 }, (_, offset) => [offset + 17, "evening"] as const),
  ])("maps local civil hour %i to %s", (hour, expected) => {
    expect(formatDaypartGreeting("Cameron", hour)).toBe(
      `Good ${expected}, Cameron`,
    );
  });

  it("cuts morning to afternoon at noon", () => {
    expect(formatDaypartGreeting("Cameron", 11)).toBe("Good morning, Cameron");
    expect(formatDaypartGreeting("Cameron", 12)).toBe("Good afternoon, Cameron");
  });

  it("cuts afternoon to evening at five o'clock", () => {
    expect(formatDaypartGreeting("Cameron", 16)).toBe("Good afternoon, Cameron");
    expect(formatDaypartGreeting("Cameron", 17)).toBe("Good evening, Cameron");
  });

  it.each([-1, 24, 12.5, Number.NaN])("rejects invalid hour %s", (hour) => {
    expect(() => formatDaypartGreeting("Cameron", hour)).toThrow(RangeError);
  });
});
