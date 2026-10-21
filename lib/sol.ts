const EARTH_DAY_MS = 86_400_000;

export const LEDGER_SOL = 21;

/** Earth-day sol containing `time`. Sols roll over at 00:00 UTC. */
export function solIndex(time: number): number {
  return Math.floor(time / EARTH_DAY_MS);
}

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
