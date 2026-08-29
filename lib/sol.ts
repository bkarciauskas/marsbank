const EARTH_DAY_MS = 86_400_000;

export const LEDGER_SOL = 21;

export function latestPostedTime(postedOn: readonly string[]): number {
  return Math.max(...postedOn.map((value) => Date.parse(value)));
}

export function solsBeforeLatest(
  postedOn: string,
  latestPostedAt: number,
): number {
  return Math.floor((latestPostedAt - Date.parse(postedOn)) / EARTH_DAY_MS);
}

export function solNumberFromLatest(
  postedOn: string,
  latestPostedAt: number,
): number {
  return LEDGER_SOL - solsBeforeLatest(postedOn, latestPostedAt);
}
