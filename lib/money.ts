export type TokenAmount = number & { readonly __brand: "TokenAmount" };

export function tokens(value: number): TokenAmount {
  if (!Number.isInteger(value)) {
    throw new Error("Token amounts must be whole tokens.");
  }
  return value as TokenAmount;
}

export function formatTokens(amount: TokenAmount): string {
  return `${groupTokens(amount)} tokens`;
}

/** Bare grouped figure, for columns that already carry the MT unit in their header. */
export function groupTokens(amount: TokenAmount): string {
  return new Intl.NumberFormat("en-AU").format(amount);
}

export function parseTokenInput(raw: string): TokenAmount | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  return tokens(Number(trimmed));
}

export function addTokens(left: TokenAmount, right: TokenAmount): TokenAmount {
  return tokens(left + right);
}

export function subtractTokens(left: TokenAmount, right: TokenAmount): TokenAmount {
  return tokens(left - right);
}
