import { describe, expect, it } from "vitest";
import {
  MARS_YEAR_SOLS,
  projectLoan,
  solsSaved,
  type LoanPosition,
  type LoanTerms,
} from "./loan-projection";
import { tokens } from "./money";

function position(remaining: number, offset: number): LoanPosition {
  return { remaining: tokens(remaining), offset: tokens(offset) };
}

function whatIf(extraOffset: number, repaidFromOffset: number) {
  return {
    extraOffset: tokens(extraOffset),
    repaidFromOffset: tokens(repaidFromOffset),
  };
}

const perMilleSol: LoanTerms = {
  levyBasisPoints: MARS_YEAR_SOLS * 10,
  repaymentPerSol: tokens(50_050),
};

describe("habitat loan projection", () => {
  it("reports what the offset covers and the levy it saves at 5.2%", () => {
    expect(projectLoan(position(10_000_000, 2_000_000))).toMatchObject({
      offsetCovers: 2_000_000,
      netPrincipal: 8_000_000,
      levySavedPerMarsYear: 104_000,
    });
  });

  it("floors the levy saved to whole tokens on the seeded loan", () => {
    const seeded = projectLoan(position(36_400_000_000, 4_002_644_620));

    expect(seeded).toMatchObject({
      offsetCovers: 4_002_644_620,
      netPrincipal: 32_397_355_380,
      levySavedPerMarsYear: 208_137_520,
    });
    expect(seeded.payoff.kind).toBe("sols");
    if (seeded.payoff.kind === "sols") {
      expect(Number.isInteger(seeded.payoff.sols)).toBe(true);
    }
  });

  it("takes a repayment out of the offset, so net principal holds", () => {
    expect(
      projectLoan(position(10_000_000, 2_000_000), whatIf(0, 1_000_000)),
    ).toMatchObject({
      offsetCovers: 1_000_000,
      netPrincipal: 8_000_000,
      levySavedPerMarsYear: 52_000,
    });
  });

  it("caps offset cover at the remaining principal", () => {
    expect(projectLoan(position(5_000_000, 9_000_000))).toMatchObject({
      offsetCovers: 5_000_000,
      netPrincipal: 0,
      levySavedPerMarsYear: 260_000,
      payoff: { kind: "sols", sols: 1 },
    });
  });

  it("counts sols of levy and repayment until the loan clears", () => {
    expect(projectLoan(position(100_000, 0), undefined, perMilleSol).payoff).toEqual({
      kind: "sols",
      sols: 3,
    });
  });

  it("pays off sooner with extra offset or a lump sum", () => {
    const today = projectLoan(position(100_000, 0), undefined, perMilleSol).payoff;
    const offset = projectLoan(position(100_000, 0), whatIf(100_000, 0), perMilleSol)
      .payoff;
    const lump = projectLoan(position(100_000, 0), whatIf(0, 50_000), perMilleSol)
      .payoff;

    expect(offset).toEqual({ kind: "sols", sols: 2 });
    expect(lump).toEqual({ kind: "sols", sols: 1 });
    expect(solsSaved(today, offset)).toBe(1);
    expect(solsSaved(today, lump)).toBe(2);
  });

  it("shortens the seeded payoff for each kind of what-if", () => {
    const seeded = position(36_400_000_000, 4_002_644_620);
    const today = projectLoan(seeded).payoff;

    for (const plan of [whatIf(1_000_000_000, 0), whatIf(0, 1_000_000_000)]) {
      const saved = solsSaved(today, projectLoan(seeded, plan).payoff);
      expect(saved).not.toBeNull();
      expect(saved).toBeGreaterThan(0);
    }
  });

  it("is paid off at once when nothing remains", () => {
    expect(projectLoan(position(0, 1_000)).payoff).toEqual({ kind: "sols", sols: 0 });
    expect(projectLoan(position(1_000, 0), whatIf(0, 5_000))).toMatchObject({
      offsetCovers: 0,
      netPrincipal: 0,
      payoff: { kind: "sols", sols: 0 },
    });
  });

  it("never pays off when the repayment cannot outpace the levy", () => {
    const atLevy = { ...perMilleSol, repaymentPerSol: tokens(100) };
    const belowLevy = { ...perMilleSol, repaymentPerSol: tokens(99) };
    const glacial = { levyBasisPoints: 0, repaymentPerSol: tokens(1) };

    expect(projectLoan(position(100_000, 0), undefined, atLevy).payoff).toEqual({
      kind: "never",
    });
    expect(projectLoan(position(100_000, 0), undefined, belowLevy).payoff).toEqual({
      kind: "never",
    });
    expect(projectLoan(position(10_000_000, 0), undefined, glacial).payoff).toEqual({
      kind: "never",
    });
  });

  it("only compares payoffs that both end", () => {
    expect(solsSaved({ kind: "sols", sols: 9 }, { kind: "sols", sols: 4 })).toBe(5);
    expect(solsSaved({ kind: "never" }, { kind: "sols", sols: 4 })).toBeNull();
    expect(solsSaved({ kind: "sols", sols: 9 }, { kind: "never" })).toBeNull();
  });
});
