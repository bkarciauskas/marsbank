export type Daypart = "morning" | "afternoon" | "evening";

type DaypartByHour = readonly [
  Daypart, Daypart, Daypart, Daypart, Daypart, Daypart,
  Daypart, Daypart, Daypart, Daypart, Daypart, Daypart,
  Daypart, Daypart, Daypart, Daypart, Daypart,
  Daypart, Daypart, Daypart, Daypart, Daypart, Daypart, Daypart,
];

const DAYPART_BY_HOUR: DaypartByHour = [
  "morning", "morning", "morning", "morning",
  "morning", "morning", "morning", "morning",
  "morning", "morning", "morning", "morning",
  "afternoon", "afternoon", "afternoon", "afternoon", "afternoon",
  "evening", "evening", "evening", "evening",
  "evening", "evening", "evening",
];

function daypartForHour(localCivilHour: number): Daypart {
  if (!Number.isInteger(localCivilHour) || localCivilHour < 0 || localCivilHour > 23) {
    throw new RangeError(
      `localCivilHour must be an integer in 0..23, received ${localCivilHour}`,
    );
  }
  const daypart = DAYPART_BY_HOUR[localCivilHour];
  if (!daypart) {
    throw new RangeError(
      `localCivilHour must be an integer in 0..23, received ${localCivilHour}`,
    );
  }
  return daypart;
}

export function formatDaypartGreeting(
  firstName: string,
  localCivilHour: number,
): `Good ${Daypart}, ${string}` {
  return `Good ${daypartForHour(localCivilHour)}, ${firstName}`;
}
