import { subtractTokens, tokens, type TokenAmount } from "./money";

export const MARS_YEAR_SOLS = Math.ceil(668.6);
const MAX_PAYOFF_SOLS = 100 * MARS_YEAR_SOLS;
const BASIS_POINTS = 10_000;

export type LoanTerms = {
  levyBasisPoints: number;
  repaymentPerSol: TokenAmount;
};

export const HABITAT_LOAN_TERMS: LoanTerms = {
  levyBasisPoints: 520,
  repaymentPerSol: tokens(6_000_000),
};

export type LoanPosition = { remaining: TokenAmount; offset: TokenAmount };

export type OffsetWhatIf = {
  extraOffset: TokenAmount;
  repaidFromOffset: TokenAmount;
};

export type Payoff = { kind: "sols"; sols: number } | { kind: "never" };

export type LoanProjection = {
  offsetCovers: TokenAmount;
  netPrincipal: TokenAmount;
  levySavedPerMarsYear: TokenAmount;
  payoff: Payoff;
};

const NO_CHANGE: OffsetWhatIf = {
  extraOffset: tokens(0),
  repaidFromOffset: tokens(0),
};

function levyPerSol(net: number, terms: LoanTerms): number {
  return Math.floor(
    (net * terms.levyBasisPoints) / (BASIS_POINTS * MARS_YEAR_SOLS),
  );
}

function payoff(remaining: number, offset: number, terms: LoanTerms): Payoff {
  if (remaining === 0) return { kind: "sols", sols: 0 };
  if (levyPerSol(Math.max(0, remaining - offset), terms) >= terms.repaymentPerSol) {
    return { kind: "never" };
  }
  let balance = remaining;
  for (let sol = 1; sol <= MAX_PAYOFF_SOLS; sol += 1) {
    balance +=
      levyPerSol(Math.max(0, balance - offset), terms) - terms.repaymentPerSol;
    if (balance <= 0) return { kind: "sols", sols: sol };
  }
  return { kind: "never" };
}

export function projectLoan(
  position: LoanPosition,
  whatIf: OffsetWhatIf = NO_CHANGE,
  terms: LoanTerms = HABITAT_LOAN_TERMS,
): LoanProjection {
  const remaining = tokens(
    Math.max(0, position.remaining - whatIf.repaidFromOffset),
  );
  const offset = tokens(
    Math.max(0, position.offset + whatIf.extraOffset - whatIf.repaidFromOffset),
  );
  const offsetCovers = tokens(Math.min(offset, remaining));
  return {
    offsetCovers,
    netPrincipal: subtractTokens(remaining, offsetCovers),
    levySavedPerMarsYear: tokens(
      Math.floor((offsetCovers * terms.levyBasisPoints) / BASIS_POINTS),
    ),
    payoff: payoff(remaining, offset, terms),
  };
}

export function solsSaved(baseline: Payoff, planned: Payoff): number | null {
  return baseline.kind === "sols" && planned.kind === "sols"
    ? baseline.sols - planned.sols
    : null;
}
