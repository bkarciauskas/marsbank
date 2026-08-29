import { describe, expect, it } from "vitest";
import { formatTokens, parseTokenInput, tokens } from "./money";

describe("model token money", () => {
  it("formats whole tokens without currency symbols", () => {
    expect(formatTokens(tokens(12400))).toBe("12,400 tokens");
  });

  it("parses grouped whole-token input", () => {
    expect(parseTokenInput("12,400")).toBe(12400);
    expect(parseTokenInput("12.5")).toBeNull();
    expect(parseTokenInput("-20")).toBeNull();
  });
});
