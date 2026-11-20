const EARTH_DAY_MS = 86_400_000;

export const LEDGER_SOL = 21;

/** Earth-day sol containing `time`. Sols roll over at 00:00 UTC. */
export function solIndex(time: number): number {
  return Math.floor(time / EARTH_DAY_MS);
}

/** One UTC earth-day. `startsAt` is inclusive and `endsAt` is the next 00:00 UTC. */
export type UtcSol = {
  index: number;
  startsAt: number;
  endsAt: number;
};

/** The UTC sol that contains `time`. */
export function utcSol(time: number): UtcSol {
  const index = solIndex(time);
  const startsAt = index * EARTH_DAY_MS;
  return { index, startsAt, endsAt: startsAt + EARTH_DAY_MS };
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
